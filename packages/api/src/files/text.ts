import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { logger } from '@librechat/data-schemas';
import { FileSources } from 'librechat-data-provider';
import type { ServerRequest } from '~/types';
import { logAxiosError, readFileAsString } from '~/utils';
import { generateShortLivedToken } from '~/crypto/jwt';
import {
  vectorizationStatusManager,
  VectorizationStatus,
} from './vectorizationStatus';

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
    formData.append('file', fileStream);

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

    // 🔥 只向量化大文档（避免资源浪费）
    const RAG_VECTOR_THRESHOLD = parseInt(process.env.RAG_VECTOR_THRESHOLD || '5000', 10);
    const estimatedTokens = Math.ceil(responseData.text.length / 3); // 估算: 1 token ≈ 3 chars
    
    if (estimatedTokens >= RAG_VECTOR_THRESHOLD) {
      logger.info(
        `[parseText] Document exceeds threshold (${estimatedTokens} tokens ≥ ${RAG_VECTOR_THRESHOLD}), triggering vectorization (ETA: 20-30 seconds)`,
      );
      logger.info(`[parseText] 🔍 Starting vectorization for file_id: ${file_id}, filename: ${file.originalname}`);
      vectorizeDocumentAsync(file, file_id, userId).catch((err) => {
        logger.warn('[parseText] Async vectorization failed (non-blocking):', err.message);
      });
    } else {
      logger.info(
        `[parseText] Skipping vectorization for small document (${estimatedTokens} tokens < ${RAG_VECTOR_THRESHOLD}) - Using full-text injection`,
      );
    }

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
 * Asynchronously vectorize document in RAG API (non-blocking)
 * Called after text extraction to enable vector search
 * 
 * @param file - The uploaded file
 * @param file_id - The file ID
 * @param userId - User ID for authentication
 */
async function vectorizeDocumentAsync(
  file: Express.Multer.File,
  file_id: string,
  userId: string,
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
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const formHeaders = formData.getHeaders();

    logger.info(
      `[vectorizeDocumentAsync] Starting vectorization for file: ${file_id}, path: ${file.path}, mime: ${file.mimetype}`,
    );

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
      `[vectorizeDocumentAsync] ✅ Vectorization completed for ${file_id} (status: ${response.status}) - Document is now ready for vector search`,
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
      message: `[vectorizeDocumentAsync] Vectorization failed for ${file_id}`,
      error,
    });
    // Don't rethrow - this is a non-blocking background operation
  }
}
