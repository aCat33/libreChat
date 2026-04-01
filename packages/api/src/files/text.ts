import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import path from 'path';
import { logger } from '@librechat/data-schemas';
import { FileSources } from 'librechat-data-provider';
import type { ServerRequest } from '~/types';
import { logAxiosError, readFileAsString } from '~/utils';
import { countTokens } from '~/utils/tokenizer';
import { generateShortLivedToken } from '~/crypto/jwt';
import { parseImage } from './images';
import {
  vectorizationStatusManager,
  VectorizationStatus,
} from './vectorizationStatus';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif',
]);

function isImageFile(file: Express.Multer.File): boolean {
  if (file.mimetype?.startsWith('image')) {
    return true;
  }
  const ext = path.extname(file.originalname ?? '').toLowerCase().replace('.', '');
  return IMAGE_EXTENSIONS.has(ext);
}

function normalizeRagFilename(filename: string): string {
  const ext = path.extname(filename);
  if (!ext) {
    return filename;
  }
  const base = path.basename(filename, ext);
  return `${base}${ext.toLowerCase()}`;
}

/**
 * Attempts to parse text using RAG API, falls back to native text parsing
 * @param params - The parameters object
 * @param params.req - The Express request object
 * @param params.file - The uploaded file
 * @param params.file_id - The file ID
 * @returns
 */
export async function parseText({
  req,
  file,
  file_id,
}: {
  req: ServerRequest;
  file: Express.Multer.File;
  file_id: string;
}): Promise<{ text: string; bytes: number; source: string }> {
  if (isImageFile(file)) {
    const userId = req.user?.id;
    const imageResult = await parseImage(file.path);

    if (userId) {
      await maybeVectorizeDocument({
        text: imageResult.text,
        file,
        file_id,
        userId,
      });
    }

    return {
      text: imageResult.text,
      bytes: Buffer.byteLength(imageResult.text, 'utf8'),
      source: FileSources.text,
    };
  }

  if (!process.env.RAG_API_URL) {
    logger.debug('[parseText] RAG_API_URL not defined, falling back to native text parsing');
    return parseTextNative(file);
  }

  const userId = req.user?.id;
  if (!userId) {
    logger.debug('[parseText] No user ID provided, falling back to native text parsing');
    return parseTextNative(file);
  }

  try {
    const healthResponse = await axios.get(`${process.env.RAG_API_URL}/health`, {
      timeout: 10000,
    });
    if (healthResponse?.statusText !== 'OK' && healthResponse?.status !== 200) {
      logger.debug('[parseText] RAG API health check failed, falling back to native parsing');
      return parseTextNative(file);
    }
  } catch (healthError) {
    logAxiosError({
      message: '[parseText] RAG API health check failed, falling back to native parsing:',
      error: healthError,
    });
    return parseTextNative(file);
  }

  let fileStream: NodeJS.ReadableStream | null = null;
  try {
    const jwtToken = generateShortLivedToken(userId);
    const formData = new FormData();
    formData.append('file_id', file_id);
    
    // Create file stream and keep reference for cleanup
    fileStream = createReadStream(file.path);
    const normalizedFilename = normalizeRagFilename(file.originalname);
    formData.append('file', fileStream, {
      filename: normalizedFilename,
      contentType: file.mimetype,
    });

    const formHeaders = formData.getHeaders();

    const response = await axios.post(`${process.env.RAG_API_URL}/text`, formData, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
        ...formHeaders,
      },
      timeout: 300000,
    });

    const responseData = response.data;
    logger.debug(`[parseText] RAG API completed successfully (${response.status})`);

    if (!('text' in responseData)) {
      throw new Error('RAG API did not return parsed text');
    }

    await maybeVectorizeDocument({ text: responseData.text, file, file_id, userId });

    return {
      text: responseData.text,
      bytes: Buffer.byteLength(responseData.text, 'utf8'),
      source: FileSources.text,
    };
  } catch (error) {
    logAxiosError({
      message: '[parseText] RAG API text parsing failed, falling back to native parsing',
      error,
    });
    return parseTextNative(file);
  } finally {
    // Ensure file stream is properly closed
    if (fileStream && typeof (fileStream as any).destroy === 'function') {
      (fileStream as any).destroy();
    }
  }
}

/**
 * Native JavaScript text parsing fallback
 * Supports .txt, .docx, .xlsx, and PDF files
 * @param file - The uploaded file
 * @returns
 */
export async function parseTextNative(file: Express.Multer.File): Promise<{
  text: string;
  bytes: number;
  source: string;
}> {
  const mimeType = file.mimetype;
  let text = '';

  try {
    // Parse .docx files
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: file.path });
      text = result.value;
      logger.info(`[parseTextNative] Extracted ${text.length} chars from .docx`);
    }
    // Parse .xlsx files
    else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(file.path);
      const sheets: string[] = [];
      
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(worksheet);
        sheets.push(`=== ${sheetName} ===\n${sheetText}`);
      });
      
      text = sheets.join('\n\n');
      logger.info(`[parseTextNative] Extracted ${text.length} chars from .xlsx (${workbook.SheetNames.length} sheets)`);
    }
    // Parse PDF files
    else if (mimeType === 'application/pdf') {
      const pdfParse = await import('pdf-parse');
      const fs = await import('fs');
      const dataBuffer = fs.readFileSync(file.path);
      // @ts-expect-error - pdf-parse module export handling
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
      logger.info(`[parseTextNative] Extracted ${text.length} chars from PDF (${pdfData.numpages} pages)`);
    }
    // Parse plain text files
    else {
      const { content } = await readFileAsString(file.path, { fileSize: file.size });
      text = content;
    }
  } catch (error) {
    logger.error('[parseTextNative] Error parsing file, falling back to raw text:', error);
    const { content } = await readFileAsString(file.path, { fileSize: file.size });
    text = content;
  }

  const bytes = Buffer.byteLength(text, 'utf8');

  return {
    text,
    bytes,
    source: FileSources.text,
  };
}

/**
 * Check token count and trigger async vectorization if document is large enough.
 * Safe to call from any text-extraction path (parseText, document_parser, OCR, etc.)
 * Non-blocking — errors are caught and logged internally.
 */
export async function maybeVectorizeDocument({
  text,
  file,
  file_id,
  userId,
}: {
  text: string;
  file: Express.Multer.File;
  file_id: string;
  userId: string;
}): Promise<void> {
  if (!process.env.RAG_API_URL) {
    return;
  }

  const RAG_VECTOR_THRESHOLD = parseInt(process.env.RAG_VECTOR_THRESHOLD || '5000', 10);
  const actualTokens = await countTokens(text);
  const fileSizeKB = (file.size / 1024).toFixed(2);
  const strategy = actualTokens >= RAG_VECTOR_THRESHOLD ? '向量检索' : '全文注入';

  logger.info(
    `📝 [文档上传] ${file.originalname} | 大小: ${fileSizeKB}KB | Tokens: ${actualTokens} | 策略: ${strategy}${actualTokens >= RAG_VECTOR_THRESHOLD ? ' | 状态: 开始向量化' : ''}`,
  );

  if (actualTokens >= RAG_VECTOR_THRESHOLD) {
    vectorizeDocumentAsync(file, file_id, userId, actualTokens, fileSizeKB).catch((err) => {
      logger.error(`❌ [向量化失败] ${file.originalname} - ${err.message}`);
    });
  }
}

/**
 * Asynchronously vectorize document in RAG API (non-blocking)
 * Called after text extraction to enable vector search
 *
 * @param file - The uploaded file
 * @param file_id - The file ID
 * @param userId - User ID for authentication
 * @param actualTokens - Actual token count (calculated by tiktoken)
 * @param fileSizeKB - File size in KB
 */
async function vectorizeDocumentAsync(
  file: Express.Multer.File,
  file_id: string,
  userId: string,
  actualTokens?: number,
  fileSizeKB?: string,
): Promise<void> {
  if (!process.env.RAG_API_URL) {
    logger.debug('[vectorizeDocumentAsync] RAG_API_URL not configured, skipping vectorization');
    return;
  }

  try {
    // Update status: Starting vectorization
    vectorizationStatusManager.updateStatus(file_id, {
      file_id,
      filename: file.originalname,
      status: VectorizationStatus.PROCESSING,
    });

    const jwtToken = generateShortLivedToken(userId);
    const formData = new FormData();
    formData.append('file_id', file_id);
    
    // Create new file stream for vectorization
    const fileStream = createReadStream(file.path);
    formData.append('file', fileStream, {
      filename: normalizeRagFilename(file.originalname),
      contentType: file.mimetype,
    });

    const formHeaders = formData.getHeaders();

    // 开始向量化（无需详细日志，已在上传时输出）

    // 🔧 使用正确的端点 /embed（完整RAG处理）
    const response = await axios.post(
      `${process.env.RAG_API_URL}/embed`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          accept: 'application/json',
          ...formHeaders,
        },
        timeout: 300000, // 5 minutes for large documents
      },
    );

    logger.info(
      `✅ [向量化完成] ${file.originalname} | 文档已就绪，可进行向量检索`,
    );

    // Update status: Completed
    vectorizationStatusManager.updateStatus(file_id, {
      status: VectorizationStatus.COMPLETED,
      progress: 100,
    });

    // Clean up stream
    if (fileStream && typeof (fileStream as any).destroy === 'function') {
      (fileStream as any).destroy();
    }
  } catch (error) {
    // Update status: Failed
    vectorizationStatusManager.updateStatus(file_id, {
      status: VectorizationStatus.FAILED,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logAxiosError({
      message: `❌ [向量化失败] ${file.originalname}`,
      error,
    });
    // Don't rethrow - this is a non-blocking background operation
  }
}
