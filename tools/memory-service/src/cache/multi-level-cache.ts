/**
 * US-004: Multi-Level Cache Client
 *
 * Provides a unified cache interface that combines:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Redis cache (fast, larger capacity)
 * - L3: PostgreSQL (source of truth)
 *
 * Cache hierarchy: L1 → L2 → Database
 */

import { getCache, CacheClient } from './client.js';
import { InMemoryCache, getContextCache, getSearchCache, getEmbeddingCache } from './in-memory-cache.js';
import { createChildLogger } from '../utils/logger.js';
import { getCacheMetricsService, CacheMetricsService } from '../services/cache-metrics.service.js';

const logger = createChildLogger('multi-level-cache');

export type CacheLevel = 'L1' | 'L2' | 'both';

export interface MultiLevelCacheOptions {
  l1TtlMs?: number;
  l2TtlSeconds?: number;
  skipL1?: boolean;
  skipL2?: boolean;
}

export interface CacheTTLConfig {
  // Context types TTL (in milliseconds for L1, seconds for L2)
  project_context: { l1Ms: number; l2Seconds: number };
  module_context: { l1Ms: number; l2Seconds: number };
  adr: { l1Ms: number; l2Seconds: number };
  knowledge_entry: { l1Ms: number; l2Seconds: number };
  session_context: { l1Ms: number; l2Seconds: number };
  // Special caches
  embedding: { l1Ms: number; l2Seconds: number };
  search: { l1Ms: number; l2Seconds: number };
}

// Default TTL configuration by context type
export const DEFAULT_CACHE_TTL: CacheTTLConfig = {
  project_context: { l1Ms: 600000, l2Seconds: 900 },     // 10 min L1, 15 min L2
  module_context: { l1Ms: 300000, l2Seconds: 600 },      // 5 min L1, 10 min L2
  adr: { l1Ms: 900000, l2Seconds: 1800 },                // 15 min L1, 30 min L2 (ADRs change rarely)
  knowledge_entry: { l1Ms: 600000, l2Seconds: 900 },     // 10 min L1, 15 min L2
  session_context: { l1Ms: 60000, l2Seconds: 120 },      // 1 min L1, 2 min L2 (session is ephemeral)
  embedding: { l1Ms: 86400000, l2Seconds: 86400 },       // 24 hours (embeddings don't change)
  search: { l1Ms: 300000, l2Seconds: 300 },              // 5 min (search results change)
};

export class MultiLevelCache {
  private l1Cache: InMemoryCache;
  private l2Cache: CacheClient;
  private metrics: CacheMetricsService;
  private ttlConfig: CacheTTLConfig;

  constructor(
    l1Cache: InMemoryCache,
    ttlConfig: Partial<CacheTTLConfig> = {}
  ) {
    this.l1Cache = l1Cache;
    this.l2Cache = getCache();
    this.metrics = getCacheMetricsService();
    this.ttlConfig = { ...DEFAULT_CACHE_TTL, ...ttlConfig };
  }

  /**
   * Get a value from cache, trying L1 first, then L2
   */
  async get<T>(
    key: string,
    contextType?: keyof CacheTTLConfig,
    options: MultiLevelCacheOptions = {}
  ): Promise<{ value: T | null; source: CacheLevel | 'miss' }> {
    const startTime = Date.now();

    // Try L1 first
    if (!options.skipL1) {
      const l1Value = this.l1Cache.get(key);
      if (l1Value !== null) {
        this.metrics.recordHit('L1', contextType);
        this.metrics.recordLatency('L1', Date.now() - startTime);
        return { value: l1Value as T, source: 'L1' };
      }
    }

    // Try L2 (Redis)
    if (!options.skipL2) {
      try {
        const l2Value = await this.l2Cache.get(key);
        if (l2Value !== null) {
          const parsed = JSON.parse(l2Value) as T;

          // Promote to L1
          if (!options.skipL1) {
            const ttl = contextType ? this.ttlConfig[contextType]?.l1Ms : undefined;
            this.l1Cache.set(key, parsed, ttl);
          }

          this.metrics.recordHit('L2', contextType);
          this.metrics.recordLatency('L2', Date.now() - startTime);
          return { value: parsed, source: 'L2' };
        }
      } catch (error) {
        logger.warn({ error, key }, 'Error reading from L2 cache');
      }
    }

    this.metrics.recordMiss(contextType);
    this.metrics.recordLatency('miss', Date.now() - startTime);
    return { value: null, source: 'miss' };
  }

  /**
   * Set a value in both cache levels
   */
  async set<T>(
    key: string,
    value: T,
    contextType?: keyof CacheTTLConfig,
    options: MultiLevelCacheOptions = {}
  ): Promise<void> {
    const ttl = contextType ? this.ttlConfig[contextType] : undefined;

    // Set in L1
    if (!options.skipL1) {
      const l1Ttl = options.l1TtlMs ?? ttl?.l1Ms;
      this.l1Cache.set(key, value, l1Ttl);
    }

    // Set in L2
    if (!options.skipL2) {
      try {
        const l2Ttl = options.l2TtlSeconds ?? ttl?.l2Seconds;
        await this.l2Cache.set(key, JSON.stringify(value), l2Ttl);
      } catch (error) {
        logger.warn({ error, key }, 'Error writing to L2 cache');
      }
    }
  }

  /**
   * Delete a value from both cache levels
   */
  async delete(key: string): Promise<void> {
    // Delete from L1
    this.l1Cache.delete(key);

    // Delete from L2
    try {
      await this.l2Cache.del(key);
    } catch (error) {
      logger.warn({ error, key }, 'Error deleting from L2 cache');
    }

    this.metrics.recordInvalidation();
  }

  /**
   * Delete all keys matching a pattern from both levels
   */
  async deletePattern(pattern: string): Promise<number> {
    // Delete from L1
    const l1Count = this.l1Cache.deletePattern(pattern);

    // Delete from L2
    let l2Count = 0;
    try {
      const keys = await this.l2Cache.keys(pattern);
      for (const key of keys) {
        await this.l2Cache.del(key);
        l2Count++;
      }
    } catch (error) {
      logger.warn({ error, pattern }, 'Error deleting pattern from L2 cache');
    }

    this.metrics.recordInvalidation(Math.max(l1Count, l2Count));
    return Math.max(l1Count, l2Count);
  }

  /**
   * Check if a key exists in either cache level
   */
  async exists(key: string): Promise<boolean> {
    // Check L1 first
    if (this.l1Cache.has(key)) {
      return true;
    }

    // Check L2
    try {
      return await this.l2Cache.exists(key);
    } catch (error) {
      logger.warn({ error, key }, 'Error checking existence in L2 cache');
      return false;
    }
  }

  /**
   * Get or set with a factory function (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    contextType?: keyof CacheTTLConfig,
    options: MultiLevelCacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, contextType, options);
    if (cached.value !== null) {
      return cached.value;
    }

    // Execute factory and cache result
    const value = await factory();
    await this.set(key, value, contextType, options);

    return value;
  }

  /**
   * Invalidate all caches for a project
   */
  async invalidateProject(projectId: string): Promise<void> {
    await this.deletePattern(`context:${projectId}:*`);
    await this.deletePattern(`search:${projectId}:*`);
    await this.deletePattern(`project:${projectId}:*`);
    logger.info({ projectId }, 'Project cache invalidated');
  }

  /**
   * Invalidate cache for a specific entry
   */
  async invalidateEntry(entryId: string, projectId?: string): Promise<void> {
    await this.delete(`context:${entryId}`);
    if (projectId) {
      // Also invalidate search cache for the project
      await this.deletePattern(`search:${projectId}:*`);
    }
    logger.debug({ entryId, projectId }, 'Entry cache invalidated');
  }

  /**
   * Get combined statistics from both cache levels
   */
  getStats(): {
    l1: ReturnType<InMemoryCache['getStats']>;
    combined: ReturnType<CacheMetricsService['getMetrics']>;
  } {
    return {
      l1: this.l1Cache.getStats(),
      combined: this.metrics.getMetrics(),
    };
  }

  /**
   * Update TTL configuration
   */
  updateTTLConfig(config: Partial<CacheTTLConfig>): void {
    this.ttlConfig = { ...this.ttlConfig, ...config };
    logger.info({ config }, 'TTL configuration updated');
  }

  /**
   * Get current TTL configuration
   */
  getTTLConfig(): CacheTTLConfig {
    return { ...this.ttlConfig };
  }
}

// Singleton instances for different cache purposes
let contextMultiCache: MultiLevelCache | null = null;
let searchMultiCache: MultiLevelCache | null = null;
let embeddingMultiCache: MultiLevelCache | null = null;

export function getContextMultiCache(ttlConfig?: Partial<CacheTTLConfig>): MultiLevelCache {
  if (!contextMultiCache) {
    contextMultiCache = new MultiLevelCache(getContextCache(), ttlConfig);
  }
  return contextMultiCache;
}

export function getSearchMultiCache(ttlConfig?: Partial<CacheTTLConfig>): MultiLevelCache {
  if (!searchMultiCache) {
    searchMultiCache = new MultiLevelCache(getSearchCache(), ttlConfig);
  }
  return searchMultiCache;
}

export function getEmbeddingMultiCache(ttlConfig?: Partial<CacheTTLConfig>): MultiLevelCache {
  if (!embeddingMultiCache) {
    embeddingMultiCache = new MultiLevelCache(getEmbeddingCache() as unknown as InMemoryCache, ttlConfig);
  }
  return embeddingMultiCache;
}

export function resetMultiCaches(): void {
  contextMultiCache = null;
  searchMultiCache = null;
  embeddingMultiCache = null;
}
