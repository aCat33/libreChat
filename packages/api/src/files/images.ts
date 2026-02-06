import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '@librechat/data-schemas';
import { recognizeImage } from './ocr/tesseract';
import type { OCRResult } from './ocr/tesseract';

const RAG_API_URL = process.env.RAG_API_URL || '';
const USE_LOCAL_OCR = process.env.USE_LOCAL_OCR === 'true';

export interface ImageParseResult {
  text: string;
  source: 'local' | 'remote';
  confidence?: number;
  language?: string;
  error?: string;
}

/**
 * Parse image using local Tesseract OCR
 * @param filepath - Path to the image file
 * @returns Parsed text result
 */
export async function parseImageLocal(filepath: string): Promise<ImageParseResult> {
  try {
    logger.info('[parseImageLocal] Processing image:', filepath);
    const result: OCRResult = await recognizeImage(filepath);

    if (result.error) {
      logger.error('[parseImageLocal] OCR error:', result.error);
      return {
        text: '',
        source: 'local',
        error: result.error,
      };
    }

    return {
      text: result.text,
      source: 'local',
      confidence: result.confidence,
      language: result.language,
    };
  } catch (error) {
    logger.error('[parseImageLocal] Failed to parse image locally:', error);
    return {
      text: '',
      source: 'local',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse image using remote RAG API
 * @param filepath - Path to the image file
 * @returns Parsed text result
 */
export async function parseImageRemote(filepath: string): Promise<ImageParseResult> {
  let fileStream: fs.ReadStream | null = null;

  try {
    logger.info('[parseImageRemote] Uploading image to RAG API:', filepath);

    if (!RAG_API_URL) {
      throw new Error('RAG_API_URL not configured');
    }

    const formData = new FormData();
    fileStream = fs.createReadStream(filepath);
    formData.append('file', fileStream);

    const response = await axios.post(`${RAG_API_URL}/api/v1/image/parse`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

    if (!response.data?.text) {
      throw new Error('Invalid response from RAG API');
    }

    logger.info('[parseImageRemote] Successfully parsed image via RAG API');

    return {
      text: response.data.text,
      source: 'remote',
    };
  } catch (error) {
    logger.error('[parseImageRemote] Failed to parse image via RAG API:', error);
    return {
      text: '',
      source: 'remote',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (fileStream?.destroy) {
      fileStream.destroy();
    }
  }
}

/**
 * Parse image with automatic fallback
 * @param filepath - Path to the image file
 * @returns Parsed text result
 */
export async function parseImage(filepath: string): Promise<ImageParseResult> {
  try {
    // Try local OCR first if enabled
    if (USE_LOCAL_OCR) {
      logger.info('[parseImage] Using local OCR');
      const localResult = await parseImageLocal(filepath);

      // If local OCR succeeded, return result
      if (localResult.text && !localResult.error) {
        return localResult;
      }

      // If local OCR failed and RAG API is available, fallback to remote
      if (RAG_API_URL) {
        logger.warn('[parseImage] Local OCR failed, falling back to RAG API');
        return await parseImageRemote(filepath);
      }

      // No fallback available, return local error
      return localResult;
    }

    // Use remote RAG API if local OCR is not enabled
    if (RAG_API_URL) {
      logger.info('[parseImage] Using remote RAG API');
      const remoteResult = await parseImageRemote(filepath);

      // If remote succeeded, return result
      if (remoteResult.text && !remoteResult.error) {
        return remoteResult;
      }

      // Remote failed, try local OCR as fallback
      logger.warn('[parseImage] RAG API failed, falling back to local OCR');
      return await parseImageLocal(filepath);
    }

    // Neither local nor remote is available
    logger.error('[parseImage] No OCR method available');
    return {
      text: '',
      source: 'local',
      error: 'No OCR method configured (set USE_LOCAL_OCR=true or RAG_API_URL)',
    };
  } catch (error) {
    logger.error('[parseImage] Unexpected error:', error);
    return {
      text: '',
      source: 'local',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
