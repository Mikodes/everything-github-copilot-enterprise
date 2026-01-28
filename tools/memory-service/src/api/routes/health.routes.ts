import { FastifyInstance } from 'fastify';
import { getDatabase } from '../../database/client.js';
import { getCache } from '../../cache/client.js';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    cache: boolean;
  };
  uptime: number;
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check endpoint
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Basic health check',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /health/detailed
   * Detailed health check with all dependencies
   */
  fastify.get<{
    Reply: HealthStatus;
  }>(
    '/health/detailed',
    {
      schema: {
        description: 'Detailed health check including all dependencies',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'boolean' },
                  cache: { type: 'boolean' },
                },
              },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const db = getDatabase();
      const cache = getCache();

      const [dbHealthy, cacheHealthy] = await Promise.all([
        db.healthCheck(),
        cache.healthCheck(),
      ]);

      const allHealthy = dbHealthy && cacheHealthy;

      const status: HealthStatus = {
        status: allHealthy ? 'healthy' : dbHealthy || cacheHealthy ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] ?? '0.1.0',
        checks: {
          database: dbHealthy,
          cache: cacheHealthy,
        },
        uptime: process.uptime(),
      };

      return reply.code(allHealthy ? 200 : 503).send(status);
    }
  );

  /**
   * GET /ready
   * Readiness probe for Kubernetes
   */
  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness probe',
        tags: ['Health'],
      },
    },
    async (request, reply) => {
      const db = getDatabase();
      const dbHealthy = await db.healthCheck();

      if (!dbHealthy) {
        return reply.code(503).send({
          status: 'not_ready',
          reason: 'database_unavailable',
        });
      }

      return reply.send({ status: 'ready' });
    }
  );

  /**
   * GET /live
   * Liveness probe for Kubernetes
   */
  fastify.get(
    '/live',
    {
      schema: {
        description: 'Liveness probe',
        tags: ['Health'],
      },
    },
    async (request, reply) => {
      return reply.send({ status: 'alive' });
    }
  );
}
