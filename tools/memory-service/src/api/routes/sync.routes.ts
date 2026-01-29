import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getCache } from '../../cache/client.js';
import { getSyncEventService } from '../../services/sync-event.service.js';
import { getWebSocketSyncService } from '../../services/websocket-sync.service.js';
import { createChildLogger } from '../../utils/logger.js';
import {
  ContextChangedMessage,
  QueuedSyncEvent,
} from '../../models/index.js';

const logger = createChildLogger('sync-routes');

// Track active SSE connections
const sseConnections = new Map<string, {
  projectId: string;
  userId: string;
  reply: FastifyReply;
}>();

/**
 * SSE (Server-Sent Events) routes for clients that don't support WebSocket.
 * Provides a fallback mechanism for real-time updates.
 */
export async function syncRoutes(server: FastifyInstance): Promise<void> {
  // ============================================
  // SSE Endpoint for Real-time Updates
  // ============================================

  /**
   * GET /sync/sse/:projectId
   * Server-Sent Events endpoint for real-time updates.
   * Fallback for clients that don't support WebSocket.
   */
  server.get<{
    Params: { projectId: string };
    Querystring: { lastSequence?: string };
  }>(
    '/sync/sse/:projectId',
    {
      schema: {
        description: 'Server-Sent Events endpoint for real-time sync updates',
        tags: ['Sync'],
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        querystring: {
          type: 'object',
          properties: {
            lastSequence: { type: 'string', description: 'Last known sequence number for catch-up' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { lastSequence } = request.query;
      const connectionId = uuidv4();

      // Extract user from JWT (simplified for now)
      const userId = 'sse-user'; // In production: extract from JWT

      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Track connection
      sseConnections.set(connectionId, {
        projectId,
        userId,
        reply,
      });

      logger.info({
        connectionId,
        projectId,
        userId,
      }, 'SSE connection established');

      // Send initial connection message
      sendSSEEvent(reply, 'connected', {
        connectionId,
        projectId,
        timestamp: Date.now(),
      });

      // If lastSequence provided, send missed events
      if (lastSequence) {
        const syncEventService = getSyncEventService();
        try {
          const missedEvents = await syncEventService.getPendingEvents({
            projectId,
            afterSequence: BigInt(lastSequence),
            limit: 100,
          });

          for (const event of missedEvents) {
            sendSSEEvent(reply, 'context_changed', {
              projectId: event.projectId,
              entityType: event.entityType,
              entityId: event.entityId,
              eventType: event.eventType,
              data: event.payload,
              userId: event.userId,
              sequenceNumber: event.sequenceNumber.toString(),
              timestamp: event.timestamp,
            });
          }

          logger.debug({
            connectionId,
            sentCount: missedEvents.length,
          }, 'Sent missed events to SSE client');
        } catch (error) {
          logger.error({ connectionId, error }, 'Error sending missed events');
        }
      }

      // Subscribe to Redis for this project
      const cache = getCache();
      const channel = `sync:${projectId}`;

      const handleRedisMessage = (data: string) => {
        try {
          const message = JSON.parse(data) as ContextChangedMessage;
          sendSSEEvent(reply, 'context_changed', message.payload);
        } catch (error) {
          logger.error({ connectionId, error }, 'Error parsing Redis message for SSE');
        }
      };

      await cache.subscribe(channel, handleRedisMessage);

      // Send periodic heartbeat
      const heartbeatInterval = setInterval(() => {
        if (!reply.raw.destroyed) {
          sendSSEEvent(reply, 'heartbeat', {
            timestamp: Date.now(),
          });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        sseConnections.delete(connectionId);
        logger.info({ connectionId, projectId }, 'SSE connection closed');
      });

      // Keep connection open
      return reply;
    }
  );

  // ============================================
  // REST API Endpoints for Sync
  // ============================================

  /**
   * GET /sync/events/:projectId
   * Get sync events for a project.
   */
  server.get<{
    Params: { projectId: string };
    Querystring: {
      afterSequence?: string;
      limit?: number;
      entityTypes?: string;
    };
  }>(
    '/sync/events/:projectId',
    {
      schema: {
        description: 'Get sync events for a project',
        tags: ['Sync'],
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        querystring: {
          type: 'object',
          properties: {
            afterSequence: { type: 'string', description: 'Get events after this sequence number' },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            entityTypes: { type: 'string', description: 'Comma-separated entity types filter' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    projectId: { type: 'string' },
                    entityType: { type: 'string' },
                    entityId: { type: 'string' },
                    eventType: { type: 'string' },
                    payload: { type: 'object' },
                    userId: { type: 'string', nullable: true },
                    sequenceNumber: { type: 'string' },
                    timestamp: { type: 'number' },
                  },
                },
              },
              currentSequence: { type: 'string' },
              hasMore: { type: 'boolean' },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { afterSequence, limit = 100, entityTypes } = request.query;

      const syncEventService = getSyncEventService();

      const events = await syncEventService.getPendingEvents({
        projectId,
        afterSequence: afterSequence ? BigInt(afterSequence) : undefined,
        limit: limit + 1, // Fetch one extra to check hasMore
        entityTypes: entityTypes ? entityTypes.split(',') : undefined,
      });

      const hasMore = events.length > limit;
      const returnEvents = hasMore ? events.slice(0, limit) : events;
      const currentSequence = await syncEventService.getCurrentSequence(projectId);

      return reply.send({
        events: returnEvents.map((e: QueuedSyncEvent) => ({
          ...e,
          sequenceNumber: e.sequenceNumber.toString(),
        })),
        currentSequence: currentSequence.toString(),
        hasMore,
      });
    }
  );

  /**
   * GET /sync/sequence/:projectId
   * Get current sequence number for a project.
   */
  server.get<{
    Params: { projectId: string };
  }>(
    '/sync/sequence/:projectId',
    {
      schema: {
        description: 'Get current sync sequence number for a project',
        tags: ['Sync'],
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              currentSequence: { type: 'string' },
              timestamp: { type: 'number' },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const syncEventService = getSyncEventService();
      const currentSequence = await syncEventService.getCurrentSequence(projectId);

      return reply.send({
        projectId,
        currentSequence: currentSequence.toString(),
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /sync/stats/:projectId
   * Get sync statistics for a project.
   */
  server.get<{
    Params: { projectId: string };
  }>(
    '/sync/stats/:projectId',
    {
      schema: {
        description: 'Get sync statistics for a project',
        tags: ['Sync'],
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              totalEvents: { type: 'integer' },
              eventsByType: { type: 'object' },
              latestSequence: { type: 'string' },
              oldestEventTime: { type: 'string', nullable: true },
              newestEventTime: { type: 'string', nullable: true },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const syncEventService = getSyncEventService();
      const stats = await syncEventService.getStats(projectId);

      return reply.send({
        ...stats,
        latestSequence: stats.latestSequence.toString(),
        oldestEventTime: stats.oldestEventTime?.toISOString() ?? null,
        newestEventTime: stats.newestEventTime?.toISOString() ?? null,
      });
    }
  );

  /**
   * GET /sync/connections
   * Get WebSocket connection statistics (admin endpoint).
   */
  server.get(
    '/sync/connections',
    {
      schema: {
        description: 'Get WebSocket connection statistics',
        tags: ['Sync'],
        response: {
          200: {
            type: 'object',
            properties: {
              connectedClients: { type: 'integer' },
              clientsByProject: { type: 'object' },
              totalSubscriptions: { type: 'integer' },
              sseConnections: { type: 'integer' },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const wsService = getWebSocketSyncService();
      const wsStats = wsService.getStats();

      return reply.send({
        ...wsStats,
        sseConnections: sseConnections.size,
      });
    }
  );

  /**
   * POST /sync/cleanup
   * Trigger cleanup of old sync events (admin endpoint).
   */
  server.post(
    '/sync/cleanup',
    {
      schema: {
        description: 'Trigger cleanup of old sync events',
        tags: ['Sync'],
        response: {
          200: {
            type: 'object',
            properties: {
              deletedCount: { type: 'integer' },
              timestamp: { type: 'number' },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const syncEventService = getSyncEventService();
      const deletedCount = await syncEventService.cleanupOldEvents();

      return reply.send({
        deletedCount,
        timestamp: Date.now(),
      });
    }
  );
}

/**
 * Helper function to send SSE events.
 */
function sendSSEEvent(reply: FastifyReply, eventType: string, data: unknown): void {
  if (reply.raw.destroyed) return;

  const eventData = JSON.stringify(data);
  reply.raw.write(`event: ${eventType}\n`);
  reply.raw.write(`data: ${eventData}\n\n`);
}
