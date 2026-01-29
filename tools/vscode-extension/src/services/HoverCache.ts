/**
 * US-010: Hover Result Cache
 *
 * Implements T-010.4: Hover result caching for improved performance.
 * Uses a simple LRU-like cache with TTL for hover results.
 */

export interface HoverCacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface HoverCacheOptions {
  maxSize: number;
  ttlMs: number;
}

const DEFAULT_OPTIONS: HoverCacheOptions = {
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
};

export class HoverCache<T> {
  private cache: Map<string, HoverCacheEntry<T>>;
  private options: HoverCacheOptions;

  constructor(options: Partial<HoverCacheOptions> = {}) {
    this.cache = new Map();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a cache key from file path, line, and character position
   */
  static generateKey(filePath: string, line: number, symbolName: string): string {
    return `${filePath}:${line}:${symbolName}`;
  }

  /**
   * Get an item from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Update hit count
    entry.hits++;
    return entry.value;
  }

  /**
   * Set an item in the cache
   */
  set(key: string, value: T): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove an item from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate entries matching a pattern (e.g., all entries for a file)
   */
  invalidateByPattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      ttlMs: this.options.ttlMs,
    };
  }

  /**
   * Evict the oldest entries from the cache
   */
  private evictOldest(): void {
    // Sort by timestamp and evict oldest 10%
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const evictCount = Math.max(1, Math.floor(this.options.maxSize * 0.1));
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}
