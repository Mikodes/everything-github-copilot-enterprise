/**
 * US-004: Cache Metrics API Routes
 *
 * Exposes cache performance metrics and management endpoints:
 * - GET /cache/metrics - JSON format metrics
 * - GET /cache/metrics/prometheus - Prometheus format
 * - GET /cache/stats - Detailed statistics
 * - POST /cache/preload - Trigger preloading
 * - POST /cache/invalidate - Invalidate cache entries
 * - GET /cache/config - Get TTL configuration
 * - PUT /cache/config - Update TTL configuration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCacheMetricsService, CacheMetrics } from '../../services/cache-metrics.service.js';
import { getPredictiveLoaderService } from '../../services/predictive-loader.service.js';
import { getContextMultiCache, getSearchMultiCache, DEFAULT_CACHE_TTL, CacheTTLConfig } from '../../cache/multi-level-cache.js';
import { getContextCache, getSearchCache, getEmbeddingCache } from '../../cache/in-memory-cache.js';

interface MetricsResponse {
  metrics: CacheMetrics;
  l1Stats: {
    context: ReturnType<ReturnType<typeof getContextCache>['getStats']>;
    search: ReturnType<ReturnType<typeof getSearchCache>['getStats']>;
    embedding: ReturnType<ReturnType<typeof getEmbeddingCache>['getStats']>;
  };
  predictiveLoader: ReturnType<ReturnType<typeof getPredictiveLoaderService>['getStats']>;
}

interface PreloadRequest {
  projectId?: string;
  immediate?: boolean;
}

interface InvalidateRequest {
  pattern?: string;
  entryId?: string;
  projectId?: string;
}

interface TTLConfigRequest {
  config: Partial<CacheTTLConfig>;
}

export async function cacheRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /cache/metrics
   * Get cache metrics in JSON format
   */
  fastify.get<{
    Reply: MetricsResponse;
  }>(
    '/cache/metrics',
    {
      schema: {
        description: 'Get cache performance metrics',
        tags: ['Cache'],
        response: {
          200: {
            type: 'object',
            properties: {
              metrics: { type: 'object' },
              l1Stats: { type: 'object' },
              predictiveLoader: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metricsService = getCacheMetricsService();
      const loaderService = getPredictiveLoaderService();

      const response: MetricsResponse = {
        metrics: metricsService.getMetrics(),
        l1Stats: {
          context: getContextCache().getStats(),
          search: getSearchCache().getStats(),
          embedding: getEmbeddingCache().getStats(),
        },
        predictiveLoader: loaderService.getStats(),
      };

      return reply.send(response);
    }
  );

  /**
   * GET /cache/metrics/prometheus
   * Get cache metrics in Prometheus format
   */
  fastify.get(
    '/cache/metrics/prometheus',
    {
      schema: {
        description: 'Get cache metrics in Prometheus format',
        tags: ['Cache'],
        produces: ['text/plain'],
        response: {
          200: {
            type: 'string',
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metricsService = getCacheMetricsService();
      const prometheus = metricsService.toPrometheusFormat();

      return reply
        .header('Content-Type', 'text/plain; charset=utf-8')
        .send(prometheus);
    }
  );

  /**
   * GET /cache/stats
   * Get detailed cache statistics
   */
  fastify.get(
    '/cache/stats',
    {
      schema: {
        description: 'Get detailed cache statistics per level',
        tags: ['Cache'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metricsService = getCacheMetricsService();

      return reply.send({
        levels: {
          L1: metricsService.getLevelMetrics('L1'),
          L2: metricsService.getLevelMetrics('L2'),
        },
        predictive: metricsService.getPredictiveMetrics().topKeys,
        preloadCandidates: metricsService.getPreloadCandidates(10),
      });
    }
  );

  /**
   * POST /cache/preload
   * Trigger cache preloading
   */
  fastify.post<{
    Body: PreloadRequest;
  }>(
    '/cache/preload',
    {
      schema: {
        description: 'Trigger cache preloading',
        tags: ['Cache'],
        body: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Specific project to preload' },
            immediate: { type: 'boolean', description: 'Run immediately vs schedule' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              preloaded: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: PreloadRequest }>, reply: FastifyReply) => {
      const loaderService = getPredictiveLoaderService();
      const { projectId, immediate } = request.body;

      if (projectId) {
        // Preload specific project
        const preloaded = await loaderService.preloadProject(projectId);
        return reply.send({
          success: true,
          preloaded,
          message: `Preloaded ${preloaded} entries for project ${projectId}`,
        });
      }

      if (immediate) {
        // Run immediate preload cycle
        const result = await loaderService.runPreloadCycle();
        return reply.send({
          success: true,
          preloaded: result.preloaded,
          message: `Preload cycle completed: ${result.preloaded}/${result.candidates} entries`,
        });
      }

      // Start the preloader if not already running
      loaderService.start();
      return reply.send({
        success: true,
        preloaded: 0,
        message: 'Predictive preloader started',
      });
    }
  );

  /**
   * POST /cache/invalidate
   * Invalidate cache entries
   */
  fastify.post<{
    Body: InvalidateRequest;
  }>(
    '/cache/invalidate',
    {
      schema: {
        description: 'Invalidate cache entries',
        tags: ['Cache'],
        body: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Key pattern to invalidate (e.g., context:*)' },
            entryId: { type: 'string', description: 'Specific entry ID to invalidate' },
            projectId: { type: 'string', description: 'Invalidate all entries for a project' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              invalidated: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: InvalidateRequest }>, reply: FastifyReply) => {
      const { pattern, entryId, projectId } = request.body;
      const contextCache = getContextMultiCache();
      let invalidated = 0;

      if (entryId) {
        await contextCache.invalidateEntry(entryId, projectId);
        invalidated = 1;
      } else if (projectId) {
        await contextCache.invalidateProject(projectId);
        invalidated = -1; // Unknown count
      } else if (pattern) {
        invalidated = await contextCache.deletePattern(pattern);
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Must provide pattern, entryId, or projectId',
        });
      }

      return reply.send({
        success: true,
        invalidated,
      });
    }
  );

  /**
   * GET /cache/config
   * Get current TTL configuration
   */
  fastify.get(
    '/cache/config',
    {
      schema: {
        description: 'Get cache TTL configuration',
        tags: ['Cache'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const contextCache = getContextMultiCache();

      return reply.send({
        ttlConfig: contextCache.getTTLConfig(),
        defaults: DEFAULT_CACHE_TTL,
      });
    }
  );

  /**
   * PUT /cache/config
   * Update TTL configuration
   */
  fastify.put<{
    Body: TTLConfigRequest;
  }>(
    '/cache/config',
    {
      schema: {
        description: 'Update cache TTL configuration',
        tags: ['Cache'],
        body: {
          type: 'object',
          required: ['config'],
          properties: {
            config: {
              type: 'object',
              description: 'Partial TTL configuration to update',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              config: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: TTLConfigRequest }>, reply: FastifyReply) => {
      const { config } = request.body;

      // Update all multi-level caches
      getContextMultiCache().updateTTLConfig(config);
      getSearchMultiCache().updateTTLConfig(config);

      return reply.send({
        success: true,
        config: getContextMultiCache().getTTLConfig(),
      });
    }
  );

  /**
   * POST /cache/reset-stats
   * Reset cache statistics (useful for testing/debugging)
   */
  fastify.post(
    '/cache/reset-stats',
    {
      schema: {
        description: 'Reset cache statistics',
        tags: ['Cache'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metricsService = getCacheMetricsService();
      metricsService.reset();

      // Reset L1 cache stats
      getContextCache().resetStats();
      getSearchCache().resetStats();
      getEmbeddingCache().resetStats();

      return reply.send({
        success: true,
        message: 'Cache statistics reset',
      });
    }
  );
}
