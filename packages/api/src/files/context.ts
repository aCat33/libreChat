import { logger } from '@librechat/data-schemas';
import { FileSources, mergeFileConfig } from 'librechat-data-provider';
import type { IMongoFile } from '@librechat/data-schemas';
import type { ServerRequest } from '~/types';
import { processTextWithTokenLimit } from '~/utils/text';
import {
  getRAGConfig,
  shouldUseVectorSearch,
  vectorSearch,
  vectorSearchMultiple,
  formatChunks,
} from './ragRetrieval';

/**
 * Extracts text context from attachments and returns formatted text.
 * This handles text that was already extracted from files (OCR, transcriptions, document text, etc.)
 * 
 * Enhanced version with hybrid RAG strategy:
 * - Small documents: Full text injection
 * - Large documents: Vector similarity search
 * - Configurable via environment variables
 * 
 * @param params - The parameters object
 * @param params.attachments - Array of file attachments
 * @param params.req - Express request object for config access
 * @param params.tokenCountFn - Function to count tokens in text
 * @param params.userQuery - Optional user query for vector search
 * @returns The formatted file context text, or undefined if no text found
 */
export async function extractFileContext({
  attachments,
  req,
  tokenCountFn,
  userQuery,
}: {
  attachments: IMongoFile[];
  req?: ServerRequest;
  tokenCountFn: (text: string) => number;
  userQuery?: string;
}): Promise<string | undefined> {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  // Log function entry for debugging
  logger.info(
    `[extractFileContext] Called with ${attachments.length} attachment(s), userQuery: ${userQuery ? `"${userQuery.substring(0, 50)}..."` : 'none'}`,
  );

  const fileConfig = mergeFileConfig(req?.config?.fileConfig);
  const fileTokenLimit = req?.body?.fileTokenLimit ?? fileConfig.fileTokenLimit;

  if (!fileTokenLimit) {
    // If no token limit, return undefined (no processing)
    return undefined;
  }

  const ragConfig = getRAGConfig();
  const userId = req?.user?.id;
  let resultText = '';

  // Separate files into small and large based on token count
  const smallFiles: IMongoFile[] = [];
  const largeFiles: IMongoFile[] = [];

  for (const file of attachments) {
    const source = file.source ?? FileSources.local;
    if (source === FileSources.text && file.text) {
      const tokenCount = await tokenCountFn(file.text);
      const useVectorSearch = await shouldUseVectorSearch(file, tokenCountFn);
      if (useVectorSearch) {
        logger.info(
          `[extractFileContext] Large file detected: "${file.filename}" (${tokenCount} tokens)`,
        );
        largeFiles.push(file);
      } else {
        logger.info(
          `[extractFileContext] Small file detected: "${file.filename}" (${tokenCount} tokens)`,
        );
        smallFiles.push(file);
      }
    } else {
      logger.warn(
        `[extractFileContext] Skipping file "${file.filename}": source=${source}, hasText=${!!file.text}`,
      );
    }
  }

  logger.info(
    `[extractFileContext] File classification: ${smallFiles.length} small, ${largeFiles.length} large`,
  );

  // Process small files with full context (original behavior)
  if (smallFiles.length > 0) {
    logger.info(
      `[extractFileContext] Processing ${smallFiles.length} small file(s) with full text injection`,
    );
  }
  
  for (const file of smallFiles) {
    const { text: limitedText, wasTruncated } = await processTextWithTokenLimit({
      text: file.text!,
      tokenLimit: fileTokenLimit,
      tokenCountFn,
    });

    if (wasTruncated) {
      logger.warn(
        `[extractFileContext] Text truncated for "${file.filename}" due to token limit (${fileTokenLimit})`,
      );
    }

    resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"\n${limitedText}\n`;
  }

  // Process large files with vector search (if query provided and RAG API available)
  if (largeFiles.length > 0 && userQuery && userId && process.env.RAG_API_URL) {
    logger.info(
      `[extractFileContext] Using vector search for ${largeFiles.length} large file(s)`,
    );

    try {
      // Multi-file vector search
      if (largeFiles.length > 1) {
        const fileIds = largeFiles.map(f => f.file_id).filter(Boolean) as string[];
        const chunks = await vectorSearchMultiple(userQuery, fileIds, userId, ragConfig.topK);

        if (chunks.length > 0) {
          // Group chunks by file_id
          const chunksByFile = new Map<string, typeof chunks>();
          chunks.forEach(chunk => {
            const fileId = chunk.metadata.file_id;
            if (!chunksByFile.has(fileId)) {
              chunksByFile.set(fileId, []);
            }
            chunksByFile.get(fileId)!.push(chunk);
          });

          // Format each file's chunks
          for (const file of largeFiles) {
            const fileChunks = chunksByFile.get(file.file_id || '');
            if (fileChunks && fileChunks.length > 0) {
              const formattedChunks = formatChunks(fileChunks, file.filename);
              resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}${formattedChunks}`;
            }
          }
        }
      } 
      // Single file vector search
      else {
        const file = largeFiles[0];
        if (file.file_id) {
          const chunks = await vectorSearch(userQuery, file.file_id, userId, ragConfig.topK);
          
          if (chunks.length > 0) {
            const formattedChunks = formatChunks(chunks, file.filename);
            resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}${formattedChunks}`;
          } else {
            // Fallback to truncated full text if vector search returns nothing
            logger.warn(
              `[extractFileContext] ⚠️ Vector search returned no results for ${file.filename}. Possible reasons: 1) Vectorization still in progress (wait 20-30s for completion log), 2) Document not vectorized, 3) Query mismatch. Falling back to full text.`,
            );
            const { text: limitedText } = await processTextWithTokenLimit({
              text: file.text!,
              tokenLimit: fileTokenLimit,
              tokenCountFn,
            });
            resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"\n${limitedText}\n`;
          }
        }
      }
    } catch (error) {
      logger.error('[extractFileContext] Vector search failed, falling back to full text', error);
      
      // Fallback to full text for large files
      for (const file of largeFiles) {
        const { text: limitedText, wasTruncated } = await processTextWithTokenLimit({
          text: file.text!,
          tokenLimit: fileTokenLimit,
          tokenCountFn,
        });

        if (wasTruncated) {
          logger.debug(
            `[extractFileContext] Text content truncated for file: ${file.filename} due to token limits`,
          );
        }

        resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"\n${limitedText}\n`;
      }
    }
  } 
  // Fallback to full text if no query or RAG API not available
  else if (largeFiles.length > 0) {
    logger.debug(
      `[extractFileContext] No user query or RAG API, using full text for ${largeFiles.length} large file(s)`,
    );
    
    for (const file of largeFiles) {
      const { text: limitedText, wasTruncated } = await processTextWithTokenLimit({
        text: file.text!,
        tokenLimit: fileTokenLimit,
        tokenCountFn,
      });

      if (wasTruncated) {
        logger.debug(
          `[extractFileContext] Text content truncated for file: ${file.filename} due to token limits`,
        );
      }

      resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"\n${limitedText}\n`;
    }
  }

  if (resultText) {
    resultText += '\n```\n\n--- 文档上下文说明 ---\n此上下文来自上传的文件。如果对话中MCP工具调用提供了结构化数据，当出现冲突时请优先使用MCP数据而非此文档上下文。';
    return resultText;
  }

  return undefined;
}
