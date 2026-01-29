import type { FastifyInstance } from 'fastify';
import type { WebSocket, RawData } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import { getContextService } from './context.service.js';
import { getSyncEventService } from './sync-event.service.js';
import {
  ConnectedClient,
  SyncMessage,
  SyncMessageSchema,
  UserPresence,
  SubscribeMessage,
  UnsubscribeMessage,
  ContextUpdateMessage,
  PresenceUpdateMessage,
  SyncRequestMessage,
  ContextChangedMessage,
  PresenceChangedMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  SyncResponseMessage,
  AckMessage,
  ErrorMessage,
  HeartbeatMessage,
  ErrorCode,
  SyncServiceConfig,
  DEFAULT_SYNC_CONFIG,
  QueuedSyncEvent,
  ConflictInfo,
} from '../models/index.js';

const logger = createChildLogger('websocket-sync-service');

export interface AuthPayload {
  userId: string;
  userName: string;
  email?: string;
  organizationId?: string;
}

/**
 * WebSocketSyncService manages real-time synchronization via WebSocket connections.
 *
 * Features:
 * - Project-based subscription management
 * - Real-time context change broadcasting
 * - User presence tracking
 * - Offline mode support with sync-on-reconnect
 * - Conflict detection and resolution
 * - Heartbeat monitoring
 * - Multi-instance support via Redis Pub/Sub
 */
export class WebSocketSyncService {
  private clients: Map<string, ConnectedClient> = new Map();
  private projectClients: Map<string, Set<string>> = new Map();
  private presenceByProject: Map<string, Map<string, UserPresence>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private redisSubscriptions: Set<string> = new Set();
  private config: SyncServiceConfig;

  constructor(config: Partial<SyncServiceConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  /**
   * Register WebSocket routes with Fastify.
   */
  async register(server: FastifyInstance): Promise<void> {
    // Register the @fastify/websocket plugin
    await server.register(import('@fastify/websocket'));

    // WebSocket route for sync connections
    server.get('/ws/sync', { websocket: true }, (socket, request) => {
      this.handleConnection(socket, request);
    });

    logger.info('WebSocket sync routes registered');
  }

  /**
   * Start the heartbeat monitoring interval.
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatIntervalMs);

    logger.info({ intervalMs: this.config.heartbeatIntervalMs }, 'Heartbeat monitoring started');
  }

  /**
   * Stop the heartbeat monitoring interval.
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat monitoring stopped');
    }
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleConnection(socket: WebSocket, request: { headers: Record<string, string | string[] | undefined> }): void {
    const clientId = uuidv4();

    // Extract auth from query or headers (simplified - should use JWT in production)
    const authHeader = request.headers['authorization'];
    const auth = this.extractAuth(authHeader as string | undefined);

    if (!auth) {
      this.sendError(socket, 'UNAUTHORIZED', 'Authentication required');
      socket.close(1008, 'Unauthorized');
      return;
    }

    const now = Date.now();

    const client: ConnectedClient = {
      id: clientId,
      userId: auth.userId,
      userName: auth.userName,
      projectSubscriptions: new Set(),
      presence: {
        userId: auth.userId,
        userName: auth.userName,
        status: 'online',
        currentModule: null,
        currentEntry: null,
        lastActivity: now,
        metadata: {},
      },
      lastHeartbeat: now,
      connectionTime: now,
      metadata: {},
    };

    // Store the WebSocket reference
    (client as ConnectedClient & { ws: WebSocket }).ws = socket;

    this.clients.set(clientId, client);

    logger.info({
      clientId,
      userId: auth.userId,
    }, 'Client connected');

    // Set up message handler
    socket.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Set up close handler
    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Set up error handler
    socket.on('error', (error) => {
      logger.error({ clientId, error }, 'WebSocket error');
    });

    // Send initial heartbeat
    this.sendHeartbeat(socket);
  }

  /**
   * Extract authentication from header (simplified).
   * In production, use JWT verification.
   */
  private extractAuth(authHeader: string | undefined): AuthPayload | null {
    if (!authHeader?.startsWith('Bearer ')) {
      // For development, allow basic auth header format: "Bearer userId:userName"
      return null;
    }

    try {
      const token = authHeader.substring(7);
      // Simplified: token is "userId:userName" for development
      // In production: JWT verification
      const [userId, userName] = token.split(':');
      if (userId && userName) {
        return { userId, userName };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Handle incoming WebSocket message.
   */
  private async handleMessage(clientId: string, data: RawData): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };

    try {
      const parsed = JSON.parse(data.toString());
      const result = SyncMessageSchema.safeParse(parsed);

      if (!result.success) {
        this.sendError(clientWithWs.ws, 'VALIDATION_ERROR', 'Invalid message format', parsed.id);
        return;
      }

      const message = result.data;

      // Update last activity
      client.lastHeartbeat = Date.now();
      client.presence.lastActivity = Date.now();

      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message as SubscribeMessage);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message as UnsubscribeMessage);
          break;
        case 'context_update':
          await this.handleContextUpdate(clientId, message as ContextUpdateMessage);
          break;
        case 'presence_update':
          await this.handlePresenceUpdate(clientId, message as PresenceUpdateMessage);
          break;
        case 'sync_request':
          await this.handleSyncRequest(clientId, message as SyncRequestMessage);
          break;
        case 'ack':
          // Client acknowledgment - could be used for delivery confirmation
          break;
        default:
          this.sendError(clientWithWs.ws, 'VALIDATION_ERROR', `Unknown message type: ${(message as SyncMessage).type}`);
      }
    } catch (error) {
      logger.error({ clientId, error }, 'Error handling message');
      this.sendError(clientWithWs.ws, 'INTERNAL_ERROR', 'Failed to process message');
    }
  }

  /**
   * Handle subscribe request.
   */
  private async handleSubscribe(clientId: string, message: SubscribeMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };
    const { projectId, lastSequence } = message.payload;

    // Add to subscriptions
    client.projectSubscriptions.add(projectId);

    // Track client in project
    if (!this.projectClients.has(projectId)) {
      this.projectClients.set(projectId, new Set());
    }
    this.projectClients.get(projectId)!.add(clientId);

    // Initialize presence tracking for project
    if (!this.presenceByProject.has(projectId)) {
      this.presenceByProject.set(projectId, new Map());
    }
    this.presenceByProject.get(projectId)!.set(client.userId, client.presence);

    // Subscribe to Redis channel for this project (for multi-instance support)
    await this.subscribeToRedisChannel(projectId);

    // Get current sequence number
    const syncEventService = getSyncEventService();
    const currentSequence = await syncEventService.getCurrentSequence(projectId);

    // Get other users' presence in this project
    const otherPresence = Array.from(this.presenceByProject.get(projectId)!.values())
      .filter(p => p.userId !== client.userId);

    // Send subscribed confirmation
    const response: SubscribedMessage = {
      id: uuidv4(),
      type: 'subscribed',
      timestamp: Date.now(),
      correlationId: message.id,
      payload: {
        projectId,
        currentSequence,
        presence: otherPresence,
      },
    };

    this.send(clientWithWs.ws, response);

    // Broadcast presence join to other clients
    this.broadcastPresenceChange(projectId, client.userId, client.presence, 'joined', clientId);

    // If lastSequence provided, send missed events
    if (lastSequence !== undefined && lastSequence < currentSequence) {
      const missedEvents = await syncEventService.getPendingEvents({
        projectId,
        afterSequence: lastSequence,
        limit: this.config.maxEventBatchSize,
      });

      for (const event of missedEvents) {
        const eventMessage: ContextChangedMessage = {
          id: uuidv4(),
          type: 'context_changed',
          timestamp: event.timestamp,
          payload: {
            projectId: event.projectId,
            entityType: event.entityType,
            entityId: event.entityId,
            eventType: event.eventType,
            data: event.payload,
            userId: event.userId,
            userName: null,
            sequenceNumber: event.sequenceNumber,
            version: event.version,
          },
        };
        this.send(clientWithWs.ws, eventMessage);
      }
    }

    logger.info({
      clientId,
      projectId,
      userId: client.userId,
    }, 'Client subscribed to project');
  }

  /**
   * Handle unsubscribe request.
   */
  private async handleUnsubscribe(clientId: string, message: UnsubscribeMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };
    const { projectId } = message.payload;

    this.removeClientFromProject(clientId, projectId);

    // Send confirmation
    const response: UnsubscribedMessage = {
      id: uuidv4(),
      type: 'unsubscribed',
      timestamp: Date.now(),
      correlationId: message.id,
      payload: { projectId },
    };

    this.send(clientWithWs.ws, response);

    logger.info({ clientId, projectId }, 'Client unsubscribed from project');
  }

  /**
   * Handle context update from client.
   */
  private async handleContextUpdate(clientId: string, message: ContextUpdateMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };
    const { projectId, updates } = message.payload;

    // Check subscription
    if (!client.projectSubscriptions.has(projectId)) {
      this.sendError(clientWithWs.ws, 'FORBIDDEN', 'Not subscribed to this project', message.id);
      return;
    }

    const contextService = getContextService();
    const syncEventService = getSyncEventService();

    for (const update of updates) {
      try {
        // Check for conflicts if baseVersion provided
        if (update.operation === 'update' && update.baseVersion !== undefined && update.entryId) {
          const conflict = await syncEventService.checkConflict({
            entryId: update.entryId,
            baseVersion: update.baseVersion,
            localTimestamp: message.timestamp,
            localUserId: client.userId,
          });

          if (conflict) {
            const resolution = syncEventService.resolveConflict(
              conflict,
              this.config.conflictResolutionStrategy
            );

            if (!resolution.shouldApply) {
              // Send conflict error
              const ack: AckMessage = {
                id: uuidv4(),
                type: 'ack',
                timestamp: Date.now(),
                correlationId: message.id,
                payload: {
                  messageId: message.id,
                  success: false,
                  error: `Conflict detected: server version ${conflict.serverVersion}, your version ${conflict.localVersion}`,
                },
              };
              this.send(clientWithWs.ws, ack);
              continue;
            }
          }
        }

        // Apply the update
        let result: Record<string, unknown> | null = null;
        let sequenceNumber: bigint | undefined;

        switch (update.operation) {
          case 'create':
            result = await contextService.create({
              projectId,
              ...update.data,
              createdBy: client.userId,
            } as Parameters<typeof contextService.create>[0]);
            break;

          case 'update':
            if (!update.entryId) {
              throw new Error('entryId required for update');
            }
            result = await contextService.update({
              id: update.entryId,
              ...update.data,
              updatedBy: client.userId,
            } as Parameters<typeof contextService.update>[0]);
            break;

          case 'delete':
            if (!update.entryId) {
              throw new Error('entryId required for delete');
            }
            await contextService.delete(update.entryId, client.userId);
            result = { id: update.entryId };
            break;
        }

        // Get the latest sequence number
        if (result) {
          sequenceNumber = await syncEventService.getCurrentSequence(projectId);
        }

        // Send success acknowledgment
        const ack: AckMessage = {
          id: uuidv4(),
          type: 'ack',
          timestamp: Date.now(),
          correlationId: message.id,
          payload: {
            messageId: message.id,
            success: true,
            sequenceNumber,
            version: (result as { version?: number })?.version,
          },
        };
        this.send(clientWithWs.ws, ack);

      } catch (error) {
        logger.error({ clientId, update, error }, 'Failed to apply context update');

        const ack: AckMessage = {
          id: uuidv4(),
          type: 'ack',
          timestamp: Date.now(),
          correlationId: message.id,
          payload: {
            messageId: message.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
        this.send(clientWithWs.ws, ack);
      }
    }
  }

  /**
   * Handle presence update from client.
   */
  private async handlePresenceUpdate(clientId: string, message: PresenceUpdateMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };
    const { projectId, presence: presenceUpdate } = message.payload;

    // Check subscription
    if (!client.projectSubscriptions.has(projectId)) {
      this.sendError(clientWithWs.ws, 'FORBIDDEN', 'Not subscribed to this project', message.id);
      return;
    }

    // Update client's presence
    client.presence = {
      ...client.presence,
      ...presenceUpdate,
      userId: client.userId,
      userName: client.userName,
      lastActivity: Date.now(),
    };

    // Update in project presence map
    this.presenceByProject.get(projectId)?.set(client.userId, client.presence);

    // Broadcast to other clients
    this.broadcastPresenceChange(projectId, client.userId, client.presence, 'updated', clientId);

    logger.debug({
      clientId,
      projectId,
      status: client.presence.status,
    }, 'Presence updated');
  }

  /**
   * Handle sync request (for offline mode catch-up).
   */
  private async handleSyncRequest(clientId: string, message: SyncRequestMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const clientWithWs = client as ConnectedClient & { ws: WebSocket };
    const { projectId, lastSequence, pendingUpdates } = message.payload;

    // Check subscription
    if (!client.projectSubscriptions.has(projectId)) {
      this.sendError(clientWithWs.ws, 'FORBIDDEN', 'Not subscribed to this project', message.id);
      return;
    }

    const syncEventService = getSyncEventService();
    const contextService = getContextService();

    // Get missed events since lastSequence
    const missedEvents = await syncEventService.getPendingEvents({
      projectId,
      afterSequence: lastSequence,
      limit: this.config.maxEventBatchSize,
    });

    const currentSequence = await syncEventService.getCurrentSequence(projectId);

    // Process pending updates from client
    const conflicts: ConflictInfo[] = [];
    const acceptedUpdates: string[] = [];
    const rejectedUpdates: { id: string; reason: string }[] = [];

    for (const update of pendingUpdates) {
      const updateId = update.entryId ?? uuidv4();

      try {
        // Check for conflicts
        if (update.operation === 'update' && update.baseVersion !== undefined && update.entryId) {
          const conflict = await syncEventService.checkConflict({
            entryId: update.entryId,
            baseVersion: update.baseVersion,
            localTimestamp: message.timestamp,
            localUserId: client.userId,
          });

          if (conflict) {
            const resolution = syncEventService.resolveConflict(
              conflict,
              this.config.conflictResolutionStrategy
            );

            if (!resolution.shouldApply) {
              conflicts.push(resolution.resolvedConflict);
              rejectedUpdates.push({
                id: updateId,
                reason: 'Conflict - server version is newer',
              });
              continue;
            }
          }
        }

        // Apply update
        switch (update.operation) {
          case 'create':
            await contextService.create({
              projectId,
              ...update.data,
              createdBy: client.userId,
            } as Parameters<typeof contextService.create>[0]);
            break;

          case 'update':
            if (!update.entryId) {
              throw new Error('entryId required for update');
            }
            await contextService.update({
              id: update.entryId,
              ...update.data,
              updatedBy: client.userId,
            } as Parameters<typeof contextService.update>[0]);
            break;

          case 'delete':
            if (!update.entryId) {
              throw new Error('entryId required for delete');
            }
            await contextService.delete(update.entryId, client.userId);
            break;
        }

        acceptedUpdates.push(updateId);

      } catch (error) {
        rejectedUpdates.push({
          id: updateId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Send sync response
    const response: SyncResponseMessage = {
      id: uuidv4(),
      type: 'sync_response',
      timestamp: Date.now(),
      correlationId: message.id,
      payload: {
        projectId,
        currentSequence,
        missedEvents: missedEvents.map((event: QueuedSyncEvent) => ({
          entityType: event.entityType,
          entityId: event.entityId,
          eventType: event.eventType,
          data: event.payload,
          userId: event.userId,
          sequenceNumber: event.sequenceNumber,
          timestamp: event.timestamp,
        })),
        conflicts,
        acceptedUpdates,
        rejectedUpdates,
      },
    };

    this.send(clientWithWs.ws, response);

    logger.info({
      clientId,
      projectId,
      missedEventsCount: missedEvents.length,
      acceptedCount: acceptedUpdates.length,
      rejectedCount: rejectedUpdates.length,
      conflictsCount: conflicts.length,
    }, 'Sync request processed');
  }

  /**
   * Handle client disconnect.
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all project subscriptions
    for (const projectId of client.projectSubscriptions) {
      this.removeClientFromProject(clientId, projectId);
    }

    // Remove client
    this.clients.delete(clientId);

    logger.info({
      clientId,
      userId: client.userId,
      sessionDuration: Date.now() - client.connectionTime,
    }, 'Client disconnected');
  }

  /**
   * Remove client from a project's subscription list.
   */
  private removeClientFromProject(clientId: string, projectId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from subscription
    client.projectSubscriptions.delete(projectId);

    // Remove from project's client list
    this.projectClients.get(projectId)?.delete(clientId);

    // Remove presence
    this.presenceByProject.get(projectId)?.delete(client.userId);

    // Broadcast presence leave
    this.broadcastPresenceChange(projectId, client.userId, client.presence, 'left', clientId);

    // Cleanup empty project tracking
    if (this.projectClients.get(projectId)?.size === 0) {
      this.projectClients.delete(projectId);
      this.presenceByProject.delete(projectId);
    }
  }

  /**
   * Broadcast presence change to all clients in a project.
   */
  private broadcastPresenceChange(
    projectId: string,
    userId: string,
    presence: UserPresence,
    action: 'joined' | 'left' | 'updated',
    excludeClientId?: string
  ): void {
    const message: PresenceChangedMessage = {
      id: uuidv4(),
      type: 'presence_changed',
      timestamp: Date.now(),
      payload: {
        projectId,
        userId,
        presence,
        action,
      },
    };

    this.broadcastToProject(projectId, message, excludeClientId);
  }

  /**
   * Broadcast a message to all clients subscribed to a project.
   */
  private broadcastToProject(projectId: string, message: SyncMessage, excludeClientId?: string): void {
    const clientIds = this.projectClients.get(projectId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      if (excludeClientId && clientId === excludeClientId) continue;

      const client = this.clients.get(clientId) as (ConnectedClient & { ws: WebSocket }) | undefined;
      if (client?.ws) {
        this.send(client.ws, message);
      }
    }
  }

  /**
   * Subscribe to Redis channel for a project (multi-instance support).
   */
  private async subscribeToRedisChannel(projectId: string): Promise<void> {
    const channel = `sync:${projectId}`;

    if (this.redisSubscriptions.has(channel)) return;

    const cache = getCache();

    await cache.subscribe(channel, (data) => {
      try {
        const message = JSON.parse(data) as ContextChangedMessage;
        // Broadcast to local clients
        this.broadcastToProject(projectId, message);
      } catch (error) {
        logger.error({ channel, error }, 'Error processing Redis message');
      }
    });

    this.redisSubscriptions.add(channel);
    logger.debug({ projectId }, 'Subscribed to Redis channel');
  }

  /**
   * Send a message to a WebSocket client.
   */
  private send(socket: WebSocket, message: SyncMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      logger.error({ error }, 'Error sending WebSocket message');
    }
  }

  /**
   * Send an error message to a WebSocket client.
   */
  private sendError(socket: WebSocket, code: ErrorCode, message: string, correlationId?: string): void {
    const errorMessage: ErrorMessage = {
      id: uuidv4(),
      type: 'error',
      timestamp: Date.now(),
      payload: {
        code,
        message,
        correlationId,
      },
    };
    this.send(socket, errorMessage);
  }

  /**
   * Send a heartbeat message to a WebSocket client.
   */
  private sendHeartbeat(socket: WebSocket): void {
    const heartbeat: HeartbeatMessage = {
      id: uuidv4(),
      type: 'heartbeat',
      timestamp: Date.now(),
      payload: {
        serverTime: Date.now(),
      },
    };
    this.send(socket, heartbeat);
  }

  /**
   * Check all clients for heartbeat timeout.
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = this.config.heartbeatTimeoutMs;

    for (const [clientId, client] of this.clients) {
      const clientWithWs = client as ConnectedClient & { ws: WebSocket };

      // Send heartbeat to active clients
      if (clientWithWs.ws) {
        this.sendHeartbeat(clientWithWs.ws);
      }

      // Check for timeout
      if (now - client.lastHeartbeat > timeout) {
        logger.warn({
          clientId,
          userId: client.userId,
          lastHeartbeat: client.lastHeartbeat,
        }, 'Client heartbeat timeout');

        // Close connection
        clientWithWs.ws?.close(1001, 'Heartbeat timeout');
        this.handleDisconnect(clientId);
      }
    }
  }

  /**
   * Get statistics about connected clients.
   */
  getStats(): {
    connectedClients: number;
    clientsByProject: Record<string, number>;
    totalSubscriptions: number;
  } {
    const clientsByProject: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const [projectId, clients] of this.projectClients) {
      clientsByProject[projectId] = clients.size;
      totalSubscriptions += clients.size;
    }

    return {
      connectedClients: this.clients.size,
      clientsByProject,
      totalSubscriptions,
    };
  }

  /**
   * Gracefully shutdown the WebSocket service.
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    // Close all connections
    for (const [clientId, client] of this.clients) {
      const clientWithWs = client as ConnectedClient & { ws: WebSocket };
      clientWithWs.ws?.close(1001, 'Server shutting down');
      this.clients.delete(clientId);
    }

    this.projectClients.clear();
    this.presenceByProject.clear();
    this.redisSubscriptions.clear();

    logger.info('WebSocket sync service shut down');
  }
}

// Singleton instance
let wsService: WebSocketSyncService | null = null;

export function getWebSocketSyncService(): WebSocketSyncService {
  if (!wsService) {
    wsService = new WebSocketSyncService();
  }
  return wsService;
}
