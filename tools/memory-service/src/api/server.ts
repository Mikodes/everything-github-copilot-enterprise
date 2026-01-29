import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { config, isDevelopment } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { healthRoutes } from './routes/health.routes.js';
import { contextRoutes } from './routes/context.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { cacheRoutes } from './routes/cache.routes.js';
import { autoDetectRoutes } from './routes/auto-detect.routes.js';
import { knowledgeGraphRoutes } from './routes/knowledge-graph.routes.js';
import { getWebSocketSyncService } from '../services/websocket-sync.service.js';
import { getPredictiveLoaderService } from '../services/predictive-loader.service.js';
import { getAutoContextDetectionService } from '../services/auto-context-detection.service.js';
import { getKnowledgeGraphService } from '../services/knowledge-graph.service.js';

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(isDevelopment && config.LOG_PRETTY
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
              },
            },
          }
        : {}),
    },
    trustProxy: true,
  });

  // Register plugins
  await server.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: isDevelopment ? false : undefined,
  });

  await server.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
    },
  });

  await server.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    allowList: ['127.0.0.1', '::1'],
  });

  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'EGCE Memory Service API',
        description: 'Distributed Memory Bank backend for Everything GitHub Copilot Enterprise',
        version: process.env['npm_package_version'] ?? '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Context', description: 'Context entry management' },
        { name: 'Search', description: 'Semantic and text search' },
        { name: 'Cache', description: 'Cache metrics and management' },
        { name: 'Auto-Detection', description: 'Automatic context detection (US-005)' },
        { name: 'Knowledge Graph', description: 'Knowledge graph for entity relationships (US-006)' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Auth', description: 'Authentication and authorization' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({
      err: error,
      url: request.url,
      method: request.method,
    }, 'Request error');

    // Handle Zod validation errors
    if (error.validation) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    // Handle known errors
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        code: error.code ?? 'ERROR',
        message: error.message,
      });
    }

    // Unknown errors
    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
    });
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(contextRoutes, { prefix: '/api/v1' });
  await server.register(syncRoutes, { prefix: '/api/v1' });
  await server.register(cacheRoutes, { prefix: '/api/v1' });
  await server.register(autoDetectRoutes, { prefix: '/api/v1' });
  await server.register(knowledgeGraphRoutes, { prefix: '/api/v1' });

  // Register WebSocket sync service
  const wsService = getWebSocketSyncService();
  await wsService.register(server);
  wsService.startHeartbeat();

  // Start predictive cache loader (US-004)
  const predictiveLoader = getPredictiveLoaderService();
  predictiveLoader.start();

  // Initialize auto-context detection service (US-005)
  const autoContextService = getAutoContextDetectionService();
  logger.info({ stats: autoContextService.getStats() }, 'Auto-context detection service initialized');

  // Initialize knowledge graph service (US-006)
  const knowledgeGraphService = getKnowledgeGraphService();
  logger.info({ stats: knowledgeGraphService.getServiceStats() }, 'Knowledge graph service initialized');

  // Add more route registrations here as we build out the API
  // await server.register(projectRoutes, { prefix: '/api/v1' });
  // await server.register(authRoutes, { prefix: '/api/v1' });

  return server;
}

export async function startServer(server: FastifyInstance): Promise<void> {
  try {
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info({
      port: config.PORT,
      host: config.HOST,
      env: config.NODE_ENV,
    }, 'Server started');

    logger.info(`API Documentation available at http://localhost:${config.PORT}/docs`);
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}
