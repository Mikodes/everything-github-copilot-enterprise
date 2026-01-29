/**
 * US-004: Cache Metrics Service Tests
 *
 * Tests for cache metrics collection and Prometheus export
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CacheMetricsService,
  getCacheMetricsService,
  resetCacheMetricsService,
} from '../../src/services/cache-metrics.service.js';

describe('CacheMetricsService', () => {
  let metricsService: CacheMetricsService;

  beforeEach(() => {
    metricsService = new CacheMetricsService();
  });

  afterEach(() => {
    resetCacheMetricsService();
  });

  describe('Hit/Miss Recording', () => {
    it('should record L1 cache hits', () => {
      metricsService.recordHit('L1');
      metricsService.recordHit('L1');

      const metrics = metricsService.getMetrics();
      expect(metrics.levels.L1.hits).toBe(2);
      expect(metrics.totalHits).toBe(2);
    });

    it('should record L2 cache hits', () => {
      metricsService.recordHit('L2');

      const metrics = metricsService.getMetrics();
      expect(metrics.levels.L2.hits).toBe(1);
      expect(metrics.totalHits).toBe(1);
    });

    it('should record cache misses', () => {
      metricsService.recordMiss();
      metricsService.recordMiss();
      metricsService.recordMiss();

      const metrics = metricsService.getMetrics();
      expect(metrics.totalMisses).toBe(3);
    });

    it('should calculate hit rate correctly', () => {
      // 3 hits, 1 miss = 75% hit rate
      metricsService.recordHit('L1');
      metricsService.recordHit('L1');
      metricsService.recordHit('L2');
      metricsService.recordMiss();

      const metrics = metricsService.getMetrics();
      expect(metrics.hitRate).toBe(0.75);
    });

    it('should track hits by context type', () => {
      metricsService.recordHit('L1', 'adr');
      metricsService.recordHit('L1', 'adr');
      metricsService.recordHit('L1', 'project_context');
      metricsService.recordMiss('adr');

      const metrics = metricsService.getMetrics();
      expect(metrics.contextTypes['adr']).toEqual({ hits: 2, misses: 1 });
      expect(metrics.contextTypes['project_context']).toEqual({ hits: 1, misses: 0 });
    });
  });

  describe('Latency Recording', () => {
    it('should record latency for cache operations', () => {
      metricsService.recordLatency('L1', 5);
      metricsService.recordLatency('L1', 10);
      metricsService.recordLatency('L2', 50);
      metricsService.recordLatency('miss', 100);

      const l1Metrics = metricsService.getLevelMetrics('L1');
      expect(l1Metrics.latencySum).toBe(15);
      expect(l1Metrics.latencyCount).toBe(2);
      expect(l1Metrics.avgLatencyMs).toBe(7.5);
      expect(l1Metrics.latencyMax).toBe(10);
      expect(l1Metrics.latencyMin).toBe(5);
    });

    it('should calculate overall average latency', () => {
      metricsService.recordLatency('L1', 10);
      metricsService.recordLatency('L2', 50);
      metricsService.recordLatency('miss', 100);

      const metrics = metricsService.getMetrics();
      expect(metrics.avgLatencyMs).toBeCloseTo(53.33, 1);
    });
  });

  describe('Eviction and Invalidation Tracking', () => {
    it('should record evictions', () => {
      metricsService.recordEviction('L1');
      metricsService.recordEviction('L1');
      metricsService.recordEviction('L2');

      const metrics = metricsService.getMetrics();
      expect(metrics.levels.L1.evictions).toBe(2);
      expect(metrics.levels.L2.evictions).toBe(1);
    });

    it('should record invalidations', () => {
      metricsService.recordInvalidation(5);
      metricsService.recordInvalidation(3, 'L1');

      const metrics = metricsService.getMetrics();
      // First invalidation counts for both, second only for L1
      expect(metrics.levels.L1.invalidations).toBe(8);
      expect(metrics.levels.L2.invalidations).toBe(5);
      expect(metrics.totalInvalidations).toBe(13);
    });
  });

  describe('Access Pattern Tracking', () => {
    it('should track access patterns', () => {
      metricsService.recordAccess('context:123', 'adr');
      metricsService.recordAccess('context:123', 'adr');
      metricsService.recordAccess('context:456', 'project_context');

      const predictive = metricsService.getPredictiveMetrics();
      expect(predictive.accessPatterns.size).toBe(2);
      expect(predictive.accessPatterns.get('context:123')?.accessCount).toBe(2);
      expect(predictive.accessPatterns.get('context:456')?.accessCount).toBe(1);
    });

    it('should track recent accesses', () => {
      metricsService.recordAccess('key1');
      metricsService.recordAccess('key2');
      metricsService.recordAccess('key3');

      const predictive = metricsService.getPredictiveMetrics();
      expect(predictive.recentAccesses).toHaveLength(3);
    });

    it('should calculate preload candidates', () => {
      // Record multiple accesses for different keys
      for (let i = 0; i < 10; i++) {
        metricsService.recordAccess('hot-key');
      }
      for (let i = 0; i < 3; i++) {
        metricsService.recordAccess('warm-key');
      }
      metricsService.recordAccess('cold-key');

      const candidates = metricsService.getPreloadCandidates(2);
      expect(candidates).toHaveLength(2);
      expect(candidates[0]).toBe('hot-key'); // Most accessed first
    });

    it('should return top keys by access count', () => {
      for (let i = 0; i < 20; i++) {
        metricsService.recordAccess('key-a');
      }
      for (let i = 0; i < 10; i++) {
        metricsService.recordAccess('key-b');
      }
      for (let i = 0; i < 5; i++) {
        metricsService.recordAccess('key-c');
      }

      const predictive = metricsService.getPredictiveMetrics();
      expect(predictive.topKeys[0]).toEqual({ key: 'key-a', count: 20 });
      expect(predictive.topKeys[1]).toEqual({ key: 'key-b', count: 10 });
      expect(predictive.topKeys[2]).toEqual({ key: 'key-c', count: 5 });
    });
  });

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', () => {
      metricsService.recordHit('L1', 'adr');
      metricsService.recordMiss('adr');
      metricsService.recordLatency('L1', 10);
      metricsService.recordEviction('L1');

      const prometheus = metricsService.toPrometheusFormat();

      expect(prometheus).toContain('egce_cache_hits_total{level="L1"} 1');
      expect(prometheus).toContain('egce_cache_misses_total 1');
      expect(prometheus).toContain('egce_cache_hit_rate');
      expect(prometheus).toContain('egce_cache_evictions_total{level="L1"} 1');
      expect(prometheus).toContain('egce_cache_latency_avg_ms');
      expect(prometheus).toContain('egce_cache_uptime_seconds');
    });

    it('should include context type metrics in Prometheus format', () => {
      metricsService.recordHit('L1', 'adr');
      metricsService.recordHit('L1', 'adr');
      metricsService.recordMiss('adr');

      const prometheus = metricsService.toPrometheusFormat();

      expect(prometheus).toContain('egce_cache_hits_total{context_type="adr"} 2');
      expect(prometheus).toContain('egce_cache_misses_total{context_type="adr"} 1');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Record some activity
      metricsService.recordHit('L1');
      metricsService.recordMiss();
      metricsService.recordLatency('L1', 10);
      metricsService.recordAccess('key1');

      // Reset
      metricsService.reset();

      const metrics = metricsService.getMetrics();
      expect(metrics.totalHits).toBe(0);
      expect(metrics.totalMisses).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);

      const predictive = metricsService.getPredictiveMetrics();
      expect(predictive.accessPatterns.size).toBe(0);
    });
  });

  describe('Uptime Tracking', () => {
    it('should track uptime', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = metricsService.getMetrics();
      expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Singleton Instance', () => {
  beforeEach(() => {
    resetCacheMetricsService();
  });

  afterEach(() => {
    resetCacheMetricsService();
  });

  it('should return the same instance', () => {
    const instance1 = getCacheMetricsService();
    const instance2 = getCacheMetricsService();
    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getCacheMetricsService();
    instance1.recordHit('L1');

    resetCacheMetricsService();

    const instance2 = getCacheMetricsService();
    expect(instance2.getMetrics().totalHits).toBe(0);
  });
});
