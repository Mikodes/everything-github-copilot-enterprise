/**
 * US-004: Cache Module Exports
 *
 * Central export point for all cache-related functionality
 */

// Original Redis cache client
export { getCache, closeCache, CacheClient, withCache } from './client.js';

// In-memory LRU cache (L1)
export {
  InMemoryCache,
  InMemoryCacheConfig,
  getContextCache,
  getSearchCache,
  getEmbeddingCache,
  shutdownAllCaches,
} from './in-memory-cache.js';

// Multi-level cache (L1 → L2)
export {
  MultiLevelCache,
  MultiLevelCacheOptions,
  CacheTTLConfig,
  CacheLevel,
  DEFAULT_CACHE_TTL,
  getContextMultiCache,
  getSearchMultiCache,
  getEmbeddingMultiCache,
  resetMultiCaches,
} from './multi-level-cache.js';
