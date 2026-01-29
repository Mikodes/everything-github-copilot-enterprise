/**
 * US-004: In-Memory LRU Cache (L1)
 *
 * High-performance in-memory cache with LRU eviction policy
 * and per-key TTL support. Serves as L1 cache layer before Redis (L2).
 */

import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('in-memory-cache');

interface CacheEntry<T> {
  value: T;
  expiry: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

export interface InMemoryCacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  checkIntervalMs: number;
}

export class InMemoryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Stats tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    maxSize: 0,
  };

  constructor(config: Partial<InMemoryCacheConfig> = {}) {
    this.maxSize = config.maxSize ?? 1000;
    this.defaultTtlMs = config.defaultTtlMs ?? 300000; // 5 minutes default
    this.stats.maxSize = this.maxSize;

    // Start cleanup interval
    const checkInterval = config.checkIntervalMs ?? 60000; // 1 minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, checkInterval);

    logger.info({ maxSize: this.maxSize, defaultTtlMs: this.defaultTtlMs }, 'InMemoryCache initialized');
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    // Update access metadata for LRU
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set a value in cache with optional TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict if at max capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const expiry = Date.now() + (ttlMs ?? this.defaultTtlMs);

    this.cache.set(key, {
      value,
      expiry,
      accessCount: 1,
      lastAccess: Date.now(),
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Delete all keys matching a pattern (simple glob)
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    logger.info('InMemoryCache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      ...this.stats,
      hitRate,
    };
  }

  /**
   * Reset statistics (useful for testing or periodic resets)
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get all keys matching a pattern
   */
  keys(pattern: string = '*'): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matchingKeys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const entry = this.cache.get(key);
        // Only include non-expired keys
        if (entry && Date.now() <= entry.expiry) {
          matchingKeys.push(key);
        }
      }
    }

    return matchingKeys;
  }

  /**
   * Get multiple values at once
   */
  mget(keys: string[]): (T | null)[] {
    return keys.map(key => this.get(key));
  }

  /**
   * Set multiple values at once
   */
  mset(entries: Array<{ key: string; value: T; ttlMs?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttlMs);
    }
  }

  /**
   * Get the TTL remaining for a key (in ms)
   */
  ttl(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const remaining = entry.expiry - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * Update TTL for an existing key
   */
  expire(key: string, ttlMs: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.expiry = Date.now() + ttlMs;
    return true;
  }

  /**
   * Get entry metadata (for metrics/debugging)
   */
  getEntryMetadata(key: string): { accessCount: number; lastAccess: number; expiry: number } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      accessCount: entry.accessCount,
      lastAccess: entry.lastAccess,
      expiry: entry.expiry,
    };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      logger.debug({ key: oldestKey }, 'LRU eviction');
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      logger.debug({ cleaned }, 'Expired entries cleaned up');
    }
  }

  /**
   * Shutdown the cache (clear interval, cleanup)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.info('InMemoryCache shutdown');
  }
}

// Singleton instances for different cache purposes
let contextCacheInstance: InMemoryCache | null = null;
let searchCacheInstance: InMemoryCache | null = null;
let embeddingCacheInstance: InMemoryCache<number[]> | null = null;

export function getContextCache(config?: Partial<InMemoryCacheConfig>): InMemoryCache {
  if (!contextCacheInstance) {
    contextCacheInstance = new InMemoryCache({
      maxSize: config?.maxSize ?? 1000,
      defaultTtlMs: config?.defaultTtlMs ?? 300000, // 5 min
      ...config,
    });
  }
  return contextCacheInstance;
}

export function getSearchCache(config?: Partial<InMemoryCacheConfig>): InMemoryCache {
  if (!searchCacheInstance) {
    searchCacheInstance = new InMemoryCache({
      maxSize: config?.maxSize ?? 500,
      defaultTtlMs: config?.defaultTtlMs ?? 300000, // 5 min
      ...config,
    });
  }
  return searchCacheInstance;
}

export function getEmbeddingCache(config?: Partial<InMemoryCacheConfig>): InMemoryCache<number[]> {
  if (!embeddingCacheInstance) {
    embeddingCacheInstance = new InMemoryCache<number[]>({
      maxSize: config?.maxSize ?? 2000,
      defaultTtlMs: config?.defaultTtlMs ?? 86400000, // 24 hours
      ...config,
    });
  }
  return embeddingCacheInstance;
}

export function shutdownAllCaches(): void {
  if (contextCacheInstance) {
    contextCacheInstance.shutdown();
    contextCacheInstance = null;
  }
  if (searchCacheInstance) {
    searchCacheInstance.shutdown();
    searchCacheInstance = null;
  }
  if (embeddingCacheInstance) {
    embeddingCacheInstance.shutdown();
    embeddingCacheInstance = null;
  }
}
