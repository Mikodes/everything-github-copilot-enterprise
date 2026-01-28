import OpenAI from 'openai';
import { config } from '../config/index.js';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import crypto from 'crypto';

const logger = createChildLogger('embedding-service');

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private model: string;
  private dimensions: number;

  constructor() {
    this.model = config.OPENAI_EMBEDDING_MODEL;
    this.dimensions = config.EMBEDDING_DIMENSIONS;

    if (config.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    } else {
      logger.warn('OpenAI API key not configured, semantic search will be disabled');
    }
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) {
      return null;
    }

    const cache = getCache();
    const textHash = this.hashText(text);
    const cacheKey = `embedding:${textHash}`;

    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as number[];
    }

    try {
      // Truncate text if too long (max ~8000 tokens)
      const truncatedText = this.truncateText(text, 30000);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedText,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        logger.error('No embedding returned from OpenAI');
        return null;
      }

      // Cache for 24 hours (embeddings are deterministic)
      await cache.set(cacheKey, JSON.stringify(embedding), 86400);

      logger.debug({ textLength: text.length }, 'Generated embedding');

      return embedding;
    } catch (error) {
      logger.error({ error }, 'Failed to generate embedding');
      return null;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.openai) {
      return texts.map(() => null);
    }

    const results: (number[] | null)[] = [];
    const uncachedTexts: { index: number; text: string }[] = [];
    const cache = getCache();

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text) continue;

      const textHash = this.hashText(text);
      const cached = await cache.get(`embedding:${textHash}`);

      if (cached) {
        results[i] = JSON.parse(cached) as number[];
      } else {
        uncachedTexts.push({ index: i, text });
      }
    }

    // Generate embeddings for uncached texts in batches
    if (uncachedTexts.length > 0) {
      const batchSize = 100; // OpenAI batch limit

      for (let i = 0; i < uncachedTexts.length; i += batchSize) {
        const batch = uncachedTexts.slice(i, i + batchSize);
        const truncatedTexts = batch.map((item) => this.truncateText(item.text, 30000));

        try {
          const response = await this.openai.embeddings.create({
            model: this.model,
            input: truncatedTexts,
            dimensions: this.dimensions,
          });

          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const embedding = response.data[j]?.embedding;

            if (embedding && item) {
              results[item.index] = embedding;
              const textHash = this.hashText(item.text);
              await cache.set(`embedding:${textHash}`, JSON.stringify(embedding), 86400);
            }
          }
        } catch (error) {
          logger.error({ error, batchIndex: i }, 'Failed to generate batch embeddings');
          // Set null for failed items
          for (const item of batch) {
            results[item.index] = null;
          }
        }
      }
    }

    return results;
  }

  calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
  }

  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }

    // Truncate at word boundary
    const truncated = text.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > maxChars * 0.8 ? truncated.substring(0, lastSpace) : truncated;
  }

  isEnabled(): boolean {
    return this.openai !== null;
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}
