import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { logger } from '@librechat/data-schemas';

const OCR_LANGUAGES = process.env.OCR_LANGUAGES || 'eng';
const OCR_CONFIDENCE_THRESHOLD = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '60', 10);

/**
 * OCR result interface
 */
export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  error?: string;
}

/**
 * Initialize Tesseract worker
 */
let workerInstance: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (workerInstance) {
    return workerInstance;
  }

  try {
    logger.info('[Tesseract] Initializing OCR worker with languages:', OCR_LANGUAGES);
    const worker = await createWorker(OCR_LANGUAGES);
    workerInstance = worker;
    return worker;
  } catch (error) {
    logger.error('[Tesseract] Failed to initialize worker:', error);
    throw new Error('Failed to initialize Tesseract worker');
  }
}

/**
 * Recognize text from an image file
 * @param imagePath - Path to the image file
 * @returns OCR result with text and confidence
 */
export async function recognizeImage(imagePath: string): Promise<OCRResult> {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const worker = await getWorker();
    const startTime = Date.now();

    logger.info('[Tesseract] Starting OCR for image:', path.basename(imagePath));

    const {
      data: { text, confidence },
    } = await worker.recognize(imagePath);

    const duration = Date.now() - startTime;
    logger.info(
      `[Tesseract] OCR completed in ${duration}ms, confidence: ${confidence.toFixed(2)}%`,
    );

    return {
      text: text.trim(),
      confidence: Math.round(confidence),
      language: OCR_LANGUAGES,
    };
  } catch (error) {
    logger.error('[Tesseract] OCR recognition failed:', error);
    return {
      text: '',
      confidence: 0,
      language: OCR_LANGUAGES,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Recognize text from a PDF file by converting pages to images
 * NOTE: PDF OCR requires canvas module which needs Visual Studio C++ build tools on Windows
 * @param pdfPath - Path to the PDF file
 * @returns OCR result with error message
 */
export async function recognizePDF(pdfPath: string): Promise<OCRResult> {
  logger.warn('[Tesseract] PDF OCR is not available - canvas module not installed');
  logger.debug('[Tesseract] Attempted PDF OCR on:', pdfPath);
  return {
    text: '',
    confidence: 0,
    language: OCR_LANGUAGES,
    error: 'PDF OCR requires canvas module (Visual Studio C++ build tools required on Windows)',
  };
}

/**
 * Check if OCR confidence meets the threshold
 * @param confidence - Confidence score (0-100)
 * @returns True if confidence meets threshold
 */
export function isConfidentOCR(confidence: number): boolean {
  return confidence >= OCR_CONFIDENCE_THRESHOLD;
}

/**
 * Cleanup Tesseract worker
 */
export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
      workerInstance = null;
      logger.info('[Tesseract] Worker terminated');
    } catch (error) {
      logger.error('[Tesseract] Failed to terminate worker:', error);
    }
  }
}

// Clean up on process exit
process.on('exit', () => {
  if (workerInstance) {
    workerInstance.terminate();
  }
});
