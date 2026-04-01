import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { logger } from '@librechat/data-schemas';
import type { IMongoFile } from '@librechat/data-schemas';
import { generateShortLivedToken } from '~/crypto/jwt';
import { logAxiosError } from '~/utils';

/**
 * RAG retrieval strategy configuration
 */
interface RAGConfig {
  /** Strategy for handling documents */
  strategy: 'full_context' | 'vector_search' | 'hybrid';
  /** Token threshold for switching to vector search */
  vectorSearchThreshold: number;
  /** Number of top results to retrieve */
  topK: number;
  /** Enable caching */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
}

/**
 * Document chunk from vector search
 */
interface DocumentChunk {
  page_content: string;
  metadata: {
    file_id: string;
    page?: number;
    digest?: string;
    [key: string]: any;
  };
  score?: number;
}

/**
 * Cache for file contexts and query results
 */
const contextCache = new LRUCache<string, string>({
  max: 100, // Maximum 100 entries
  ttl: 1000 * 60 * 10, // 10 minutes TTL
  updateAgeOnGet: true,
});

const queryCache = new LRUCache<string, DocumentChunk[]>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  updateAgeOnGet: true,
});

/**
 * Get RAG configuration from environment variables
 */
export function getRAGConfig(): RAGConfig {
  const strategy = (process.env.RAG_STRATEGY as RAGConfig['strategy']) || 'hybrid';
  
  return {
    strategy,
    vectorSearchThreshold: parseInt(process.env.RAG_VECTOR_THRESHOLD || '5000', 10),
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    enableCache: process.env.RAG_ENABLE_CACHE !== 'false',
    cacheTTL: parseInt(process.env.RAG_CACHE_TTL || '600000', 10), // 10 minutes
  };
}

/**
 * Perform vector similarity search through RAG API
 * @param query - User query text
 * @param fileId - File ID to search within
 * @param userId - User ID for authentication
 * @param topK - Number of top results to return
 * @returns Array of document chunks with scores
 */
export async function vectorSearch(
  query: string,
  fileId: string,
  userId: string,
  topK: number = 5,
): Promise<DocumentChunk[]> {
  if (!process.env.RAG_API_URL) {
    logger.debug('[vectorSearch] RAG_API_URL not configured');
    return [];
  }

  // Check cache first
  const cacheKey = `${fileId}:${query}:${topK}`;
  const config = getRAGConfig();
  
  if (config.enableCache) {
    const cached = queryCache.get(cacheKey);
    if (cached) {
      logger.debug('[vectorSearch] Cache hit for query');
      return cached;
    }
  }

  try {
    const jwtToken = generateShortLivedToken(userId);
    
    const response = await axios.post(
      `${process.env.RAG_API_URL}/query`,
      {
        query,
        file_id: fileId,
        k: topK,
      },
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds
      },
    );

    // Parse response - expecting array of [document, score] tuples
    const results: DocumentChunk[] = [];
    
    if (Array.isArray(response.data)) {
      for (const item of response.data) {
        if (Array.isArray(item) && item.length >= 2) {
          const [doc, score] = item;
          results.push({
            page_content: doc.page_content || doc.content || '',
            metadata: doc.metadata || {},
            score: score,
          });
        }
      }
    }

    // Only cache non-empty results to avoid poisoning the cache before vectorization completes
    if (config.enableCache && results.length > 0) {
      queryCache.set(cacheKey, results);
    }

    logger.debug(`[vectorSearch] Retrieved ${results.length} chunks for file ${fileId}`);
    return results;

  } catch (error) {
    logAxiosError({
      message: '[vectorSearch] Vector search failed',
      error,
    });
    return [];
  }
}

/**
 * Perform vector search across multiple files
 */
export async function vectorSearchMultiple(
  query: string,
  fileIds: string[],
  userId: string,
  topK: number = 10,
): Promise<DocumentChunk[]> {
  if (!process.env.RAG_API_URL || fileIds.length === 0) {
    return [];
  }

  try {
    const jwtToken = generateShortLivedToken(userId);
    
    const response = await axios.post(
      `${process.env.RAG_API_URL}/query_multiple`,
      {
        query,
        file_ids: fileIds,
        k: topK,
      },
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const results: DocumentChunk[] = [];
    
    if (Array.isArray(response.data)) {
      for (const item of response.data) {
        if (Array.isArray(item) && item.length >= 2) {
          const [doc, score] = item;
          results.push({
            page_content: doc.page_content || doc.content || '',
            metadata: doc.metadata || {},
            score: score,
          });
        }
      }
    }

    logger.debug(`[vectorSearchMultiple] Retrieved ${results.length} chunks across ${fileIds.length} files`);
    return results;

  } catch (error) {
    logAxiosError({
      message: '[vectorSearchMultiple] Multi-file vector search failed',
      error,
    });
    return [];
  }
}

/**
 * Format document chunks into readable context
 */
export function formatChunks(
  chunks: DocumentChunk[],
  filename: string,
  includeScores: boolean = false,
): string {
  if (chunks.length === 0) {
    return '';
  }

  let result = `# "${filename}"\n\n`;
  
  chunks.forEach((chunk, index) => {
    const pageInfo = chunk.metadata.page ? ` (Page ${chunk.metadata.page})` : '';
    const scoreInfo = includeScores && chunk.score !== undefined 
      ? ` [Relevance: ${(1 - chunk.score).toFixed(3)}]` 
      : '';
    
    result += `## Excerpt ${index + 1}${pageInfo}${scoreInfo}\n\n`;
    result += `${chunk.page_content}\n\n`;
    
    if (index < chunks.length - 1) {
      result += '---\n\n';
    }
  });

  return result;
}

/**
 * Estimate token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English
  // For more accurate counting, use actual tokenizer
  return Math.ceil(text.length / 4);
}

/**
 * Determine if file should use vector search based on size
 */
export async function shouldUseVectorSearch(
  file: IMongoFile,
  tokenCountFn?: (text: string) => number | Promise<number>,
): Promise<boolean> {
  const config = getRAGConfig();
  
  if (config.strategy === 'full_context') {
    return false;
  }
  
  if (config.strategy === 'vector_search') {
    return true;
  }
  
  // Hybrid strategy: check token count
  if (!file.text) {
    return false;
  }
  
  const tokenCount = tokenCountFn 
    ? await tokenCountFn(file.text) 
    : estimateTokens(file.text);
  
  return tokenCount > config.vectorSearchThreshold;
}

/**
 * Clear all caches
 */
export function clearRAGCaches(): void {
  contextCache.clear();
  queryCache.clear();
  logger.info('[RAG] All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    contextCache: {
      size: contextCache.size,
      max: contextCache.max,
    },
    queryCache: {
      size: queryCache.size,
      max: queryCache.max,
    },
  };
}
