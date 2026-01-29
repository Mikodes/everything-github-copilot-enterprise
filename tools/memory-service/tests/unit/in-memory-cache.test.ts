/**
 * US-004: In-Memory Cache Tests
 *
 * Tests for the L1 LRU cache implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InMemoryCache,
  getContextCache,
  getSearchCache,
  getEmbeddingCache,
  shutdownAllCaches,
} from '../../src/cache/in-memory-cache.js';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache({
      maxSize: 5,
      defaultTtlMs: 1000,
      checkIntervalMs: 100,
    });
  });

  afterEach(() => {
    cache.shutdown();
    shutdownAllCaches();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should delete a value', () => {
      cache.set('key1', 'value1');
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL Management', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      cache.set('key1', 'value1');
      const ttl = cache.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1000);
    });

    it('should update TTL with expire', () => {
      cache.set('key1', 'value1', 100);
      const success = cache.expire('key1', 5000);
      expect(success).toBe(true);
      expect(cache.ttl('key1')).toBeGreaterThan(4000);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used when at capacity', () => {
      // Fill cache to capacity
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 to make it recently used
      cache.get('key1');

      // Add new key, should evict key2 (LRU)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBe('value1'); // Still exists (recently used)
      expect(cache.get('key2')).toBeNull(); // Evicted (LRU)
      expect(cache.get('key6')).toBe('value6'); // New entry
    });

    it('should track evictions in stats', () => {
      // Fill and overflow
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Pattern Matching', () => {
    it('should delete keys matching pattern', () => {
      cache.set('context:1', 'value1');
      cache.set('context:2', 'value2');
      cache.set('search:1', 'value3');

      const deleted = cache.deletePattern('context:*');
      expect(deleted).toBe(2);
      expect(cache.get('context:1')).toBeNull();
      expect(cache.get('context:2')).toBeNull();
      expect(cache.get('search:1')).toBe('value3');
    });

    it('should get keys matching pattern', () => {
      cache.set('context:1', 'value1');
      cache.set('context:2', 'value2');
      cache.set('search:1', 'value3');

      const keys = cache.keys('context:*');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('context:1');
      expect(keys).toContain('context:2');
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values at once', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const values = cache.mget(['key1', 'key2', 'nonexistent']);
      expect(values).toEqual(['value1', 'value2', null]);
    });

    it('should set multiple values at once', () => {
      cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttlMs: 5000 },
      ]);

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Statistics', () => {
    it('should track hit rate', () => {
      cache.set('key1', 'value1');

      // 2 hits
      cache.get('key1');
      cache.get('key1');

      // 1 miss
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    it('should track size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Entry Metadata', () => {
    it('should track access count and last access time', async () => {
      cache.set('key1', 'value1');

      // Access multiple times
      cache.get('key1');
      cache.get('key1');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.get('key1');

      const metadata = cache.getEntryMetadata('key1');
      expect(metadata).not.toBeNull();
      expect(metadata!.accessCount).toBe(4); // 1 from set + 3 gets
    });

    it('should return null for non-existent entry metadata', () => {
      expect(cache.getEntryMetadata('nonexistent')).toBeNull();
    });
  });
});

describe('Cache Singletons', () => {
  afterEach(() => {
    shutdownAllCaches();
  });

  it('should return the same context cache instance', () => {
    const cache1 = getContextCache();
    const cache2 = getContextCache();
    expect(cache1).toBe(cache2);
  });

  it('should return the same search cache instance', () => {
    const cache1 = getSearchCache();
    const cache2 = getSearchCache();
    expect(cache1).toBe(cache2);
  });

  it('should return the same embedding cache instance', () => {
    const cache1 = getEmbeddingCache();
    const cache2 = getEmbeddingCache();
    expect(cache1).toBe(cache2);
  });

  it('should have different instances for different cache types', () => {
    const contextCache = getContextCache();
    const searchCache = getSearchCache();
    const embeddingCache = getEmbeddingCache();

    expect(contextCache).not.toBe(searchCache);
    expect(contextCache).not.toBe(embeddingCache);
    expect(searchCache).not.toBe(embeddingCache);
  });
});
