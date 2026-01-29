/**
 * US-004: Cache Metrics Service
 *
 * Collects and exposes cache performance metrics including:
 * - Hit/miss rates per cache level
 * - Latency distributions
 * - Eviction counts
 * - Invalidation tracking
 * - Per-context-type statistics
 *
 * Metrics are exportable in Prometheus format for monitoring integration.
 */

import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('cache-metrics');

export type CacheLevelMetric = 'L1' | 'L2' | 'miss';

export interface LevelStats {
  hits: number;
  misses: number;
  evictions: number;
  invalidations: number;
  latencySum: number;
  latencyCount: number;
  latencyMax: number;
  latencyMin: number;
}

export interface ContextTypeStats {
  hits: number;
  misses: number;
}

export interface CacheMetrics {
  levels: Record<CacheLevelMetric, LevelStats>;
  contextTypes: Record<string, ContextTypeStats>;
  totalHits: number;
  totalMisses: number;
  totalInvalidations: number;
  hitRate: number;
  avgLatencyMs: number;
  startTime: number;
  uptimeSeconds: number;
}

export interface PredictiveMetrics {
  accessPatterns: Map<string, AccessPattern>;
  topKeys: Array<{ key: string; count: number }>;
  recentAccesses: Array<{ key: string; timestamp: number }>;
}

export interface AccessPattern {
  key: string;
  accessCount: number;
  lastAccess: number;
  firstAccess: number;
  avgIntervalMs: number;
  accessHistory: number[];
}

const DEFAULT_LEVEL_STATS: LevelStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  invalidations: 0,
  latencySum: 0,
  latencyCount: 0,
  latencyMax: 0,
  latencyMin: Infinity,
};

export class CacheMetricsService {
  private levels: Record<CacheLevelMetric, LevelStats> = {
    L1: { ...DEFAULT_LEVEL_STATS },
    L2: { ...DEFAULT_LEVEL_STATS },
    miss: { ...DEFAULT_LEVEL_STATS },
  };

  private contextTypes: Map<string, ContextTypeStats> = new Map();
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private recentAccesses: Array<{ key: string; timestamp: number; contextType?: string }> = [];
  private startTime: number;

  // Configuration
  private readonly maxRecentAccesses = 1000;
  private readonly maxPatterns = 5000;
  private readonly patternHistorySize = 100;

  constructor() {
    this.startTime = Date.now();
    logger.info('CacheMetricsService initialized');
  }

  /**
   * Record a cache hit
   */
  recordHit(level: 'L1' | 'L2', contextType?: string): void {
    this.levels[level].hits++;

    if (contextType) {
      const stats = this.getOrCreateContextTypeStats(contextType);
      stats.hits++;
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(contextType?: string): void {
    this.levels.miss.misses++;

    if (contextType) {
      const stats = this.getOrCreateContextTypeStats(contextType);
      stats.misses++;
    }
  }

  /**
   * Record latency for a cache operation
   */
  recordLatency(level: CacheLevelMetric, latencyMs: number): void {
    const stats = this.levels[level];
    stats.latencySum += latencyMs;
    stats.latencyCount++;
    stats.latencyMax = Math.max(stats.latencyMax, latencyMs);
    stats.latencyMin = Math.min(stats.latencyMin, latencyMs);
  }

  /**
   * Record a cache eviction
   */
  recordEviction(level: 'L1' | 'L2' = 'L1'): void {
    this.levels[level].evictions++;
  }

  /**
   * Record cache invalidation(s)
   */
  recordInvalidation(count: number = 1, level?: 'L1' | 'L2'): void {
    if (level) {
      this.levels[level].invalidations += count;
    } else {
      // Count towards both levels
      this.levels.L1.invalidations += count;
      this.levels.L2.invalidations += count;
    }
  }

  /**
   * Record access for pattern analysis (predictive loading)
   */
  recordAccess(key: string, contextType?: string): void {
    const now = Date.now();

    // Update recent accesses (bounded circular buffer)
    this.recentAccesses.push({ key, timestamp: now, contextType });
    if (this.recentAccesses.length > this.maxRecentAccesses) {
      this.recentAccesses.shift();
    }

    // Update access pattern
    let pattern = this.accessPatterns.get(key);
    if (!pattern) {
      if (this.accessPatterns.size >= this.maxPatterns) {
        // Evict least recently accessed pattern
        this.evictOldestPattern();
      }

      pattern = {
        key,
        accessCount: 0,
        lastAccess: now,
        firstAccess: now,
        avgIntervalMs: 0,
        accessHistory: [],
      };
      this.accessPatterns.set(key, pattern);
    }

    // Update pattern stats
    if (pattern.accessHistory.length > 0) {
      const lastAccess = pattern.accessHistory[pattern.accessHistory.length - 1];
      const interval = now - lastAccess;

      // Update running average
      const totalIntervals = pattern.accessHistory.length;
      pattern.avgIntervalMs = (pattern.avgIntervalMs * totalIntervals + interval) / (totalIntervals + 1);
    }

    pattern.accessCount++;
    pattern.lastAccess = now;
    pattern.accessHistory.push(now);

    // Keep history bounded
    if (pattern.accessHistory.length > this.patternHistorySize) {
      pattern.accessHistory.shift();
    }
  }

  /**
   * Get overall cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalHits = this.levels.L1.hits + this.levels.L2.hits;
    const totalMisses = this.levels.miss.misses;
    const total = totalHits + totalMisses;

    const totalLatencySum = this.levels.L1.latencySum + this.levels.L2.latencySum + this.levels.miss.latencySum;
    const totalLatencyCount = this.levels.L1.latencyCount + this.levels.L2.latencyCount + this.levels.miss.latencyCount;

    return {
      levels: { ...this.levels },
      contextTypes: Object.fromEntries(this.contextTypes),
      totalHits,
      totalMisses,
      totalInvalidations: this.levels.L1.invalidations + this.levels.L2.invalidations,
      hitRate: total > 0 ? totalHits / total : 0,
      avgLatencyMs: totalLatencyCount > 0 ? totalLatencySum / totalLatencyCount : 0,
      startTime: this.startTime,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Get metrics per level
   */
  getLevelMetrics(level: CacheLevelMetric): LevelStats & { hitRate: number; avgLatencyMs: number } {
    const stats = this.levels[level];
    const total = stats.hits + stats.misses;

    return {
      ...stats,
      hitRate: total > 0 ? stats.hits / total : 0,
      avgLatencyMs: stats.latencyCount > 0 ? stats.latencySum / stats.latencyCount : 0,
    };
  }

  /**
   * Get predictive metrics for preloading decisions
   */
  getPredictiveMetrics(): PredictiveMetrics {
    // Get top keys by access count
    const topKeys = Array.from(this.accessPatterns.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 50)
      .map(([key, pattern]) => ({ key, count: pattern.accessCount }));

    return {
      accessPatterns: this.accessPatterns,
      topKeys,
      recentAccesses: this.recentAccesses.slice(-100),
    };
  }

  /**
   * Get keys that should be preloaded based on access patterns
   */
  getPreloadCandidates(maxCandidates: number = 20): string[] {
    const now = Date.now();
    const candidates: Array<{ key: string; score: number }> = [];

    for (const [key, pattern] of this.accessPatterns) {
      // Calculate score based on:
      // - Access frequency (higher = better)
      // - Recency (more recent = better)
      // - Predicted next access (if within threshold)

      const frequency = pattern.accessCount;
      const recencyMs = now - pattern.lastAccess;
      const recencyScore = Math.max(0, 1 - recencyMs / (3600000)); // Decay over 1 hour

      // Predict if likely to be accessed soon
      const timeSinceLastAccess = now - pattern.lastAccess;
      const likelyToAccessSoon = pattern.avgIntervalMs > 0 &&
        timeSinceLastAccess >= pattern.avgIntervalMs * 0.8;

      const score = frequency * 0.4 + recencyScore * 0.4 + (likelyToAccessSoon ? 0.2 : 0);

      candidates.push({ key, score });
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates)
      .map(c => c.key);
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Help and type declarations
    lines.push('# HELP egce_cache_hits_total Total cache hits by level');
    lines.push('# TYPE egce_cache_hits_total counter');
    lines.push(`egce_cache_hits_total{level="L1"} ${this.levels.L1.hits}`);
    lines.push(`egce_cache_hits_total{level="L2"} ${this.levels.L2.hits}`);

    lines.push('# HELP egce_cache_misses_total Total cache misses');
    lines.push('# TYPE egce_cache_misses_total counter');
    lines.push(`egce_cache_misses_total ${metrics.totalMisses}`);

    lines.push('# HELP egce_cache_hit_rate Cache hit rate (0-1)');
    lines.push('# TYPE egce_cache_hit_rate gauge');
    lines.push(`egce_cache_hit_rate ${metrics.hitRate.toFixed(4)}`);

    lines.push('# HELP egce_cache_evictions_total Total cache evictions by level');
    lines.push('# TYPE egce_cache_evictions_total counter');
    lines.push(`egce_cache_evictions_total{level="L1"} ${this.levels.L1.evictions}`);
    lines.push(`egce_cache_evictions_total{level="L2"} ${this.levels.L2.evictions}`);

    lines.push('# HELP egce_cache_invalidations_total Total cache invalidations');
    lines.push('# TYPE egce_cache_invalidations_total counter');
    lines.push(`egce_cache_invalidations_total ${metrics.totalInvalidations}`);

    lines.push('# HELP egce_cache_latency_avg_ms Average cache operation latency');
    lines.push('# TYPE egce_cache_latency_avg_ms gauge');
    lines.push(`egce_cache_latency_avg_ms ${metrics.avgLatencyMs.toFixed(2)}`);

    lines.push('# HELP egce_cache_uptime_seconds Cache service uptime');
    lines.push('# TYPE egce_cache_uptime_seconds gauge');
    lines.push(`egce_cache_uptime_seconds ${metrics.uptimeSeconds}`);

    // Per-context-type metrics
    for (const [type, stats] of this.contextTypes) {
      const total = stats.hits + stats.misses;
      const rate = total > 0 ? stats.hits / total : 0;
      lines.push(`egce_cache_hits_total{context_type="${type}"} ${stats.hits}`);
      lines.push(`egce_cache_misses_total{context_type="${type}"} ${stats.misses}`);
      lines.push(`egce_cache_hit_rate{context_type="${type}"} ${rate.toFixed(4)}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.levels = {
      L1: { ...DEFAULT_LEVEL_STATS },
      L2: { ...DEFAULT_LEVEL_STATS },
      miss: { ...DEFAULT_LEVEL_STATS },
    };
    this.contextTypes.clear();
    this.accessPatterns.clear();
    this.recentAccesses = [];
    this.startTime = Date.now();
    logger.info('CacheMetricsService reset');
  }

  private getOrCreateContextTypeStats(contextType: string): ContextTypeStats {
    let stats = this.contextTypes.get(contextType);
    if (!stats) {
      stats = { hits: 0, misses: 0 };
      this.contextTypes.set(contextType, stats);
    }
    return stats;
  }

  private evictOldestPattern(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, pattern] of this.accessPatterns) {
      if (pattern.lastAccess < oldestTime) {
        oldestTime = pattern.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.accessPatterns.delete(oldestKey);
    }
  }
}

// Singleton instance
let metricsInstance: CacheMetricsService | null = null;

export function getCacheMetricsService(): CacheMetricsService {
  if (!metricsInstance) {
    metricsInstance = new CacheMetricsService();
  }
  return metricsInstance;
}

export function resetCacheMetricsService(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
  metricsInstance = null;
}
