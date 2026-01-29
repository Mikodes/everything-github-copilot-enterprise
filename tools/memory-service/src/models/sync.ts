import { z } from 'zod';

// ============================================
// WebSocket Message Types
// ============================================

export const SyncMessageTypeSchema = z.enum([
  // Client -> Server
  'subscribe',
  'unsubscribe',
  'context_update',
  'presence_update',
  'sync_request',
  'ack',

  // Server -> Client
  'subscribed',
  'unsubscribed',
  'context_changed',
  'presence_changed',
  'sync_response',
  'error',
  'heartbeat',
]);

export type SyncMessageType = z.infer<typeof SyncMessageTypeSchema>;

// ============================================
// Presence Types
// ============================================

export const PresenceStatusSchema = z.enum([
  'online',
  'editing',
  'viewing',
  'idle',
  'offline',
]);

export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

export const UserPresenceSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string(),
  status: PresenceStatusSchema,
  currentModule: z.string().nullable(),
  currentEntry: z.string().uuid().nullable(),
  lastActivity: z.number(), // Unix timestamp in ms
  metadata: z.record(z.unknown()).default({}),
});

export type UserPresence = z.infer<typeof UserPresenceSchema>;

// ============================================
// Conflict Resolution
// ============================================

export const ConflictResolutionStrategySchema = z.enum([
  'last_write_wins',   // Default: most recent update wins
  'first_write_wins',  // Preserve original
  'manual',            // Queue for manual resolution
  'merge',             // Attempt automatic merge (for compatible changes)
]);

export type ConflictResolutionStrategy = z.infer<typeof ConflictResolutionStrategySchema>;

export const ConflictInfoSchema = z.object({
  entryId: z.string().uuid(),
  localVersion: z.number(),
  serverVersion: z.number(),
  localTimestamp: z.number(),
  serverTimestamp: z.number(),
  localUserId: z.string().uuid(),
  serverUserId: z.string().uuid(),
  resolution: ConflictResolutionStrategySchema,
  resolved: z.boolean(),
});

export type ConflictInfo = z.infer<typeof ConflictInfoSchema>;

// ============================================
// Sync Event Queue Entry
// ============================================

export const QueuedSyncEventSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  entityType: z.enum(['context_entry', 'adr', 'module', 'project']),
  entityId: z.string().uuid(),
  eventType: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.unknown()),
  userId: z.string().uuid().nullable(),
  timestamp: z.number(),
  sequenceNumber: z.bigint(),
  version: z.number().nullable(),
  processed: z.boolean().default(false),
  retryCount: z.number().default(0),
});

export type QueuedSyncEvent = z.infer<typeof QueuedSyncEventSchema>;

// ============================================
// Base Sync Message
// ============================================

export const BaseSyncMessageSchema = z.object({
  id: z.string().uuid(),
  type: SyncMessageTypeSchema,
  timestamp: z.number(),
  correlationId: z.string().uuid().optional(), // For request/response pairing
});

// ============================================
// Subscribe Message
// ============================================

export const SubscribeMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('subscribe'),
  payload: z.object({
    projectId: z.string().uuid(),
    modules: z.array(z.string().uuid()).optional(), // Subscribe to specific modules
    lastSequence: z.bigint().optional(), // For catching up on missed events
  }),
});

export type SubscribeMessage = z.infer<typeof SubscribeMessageSchema>;

export const SubscribedMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('subscribed'),
  payload: z.object({
    projectId: z.string().uuid(),
    currentSequence: z.bigint(),
    presence: z.array(UserPresenceSchema), // Other users in the project
  }),
});

export type SubscribedMessage = z.infer<typeof SubscribedMessageSchema>;

// ============================================
// Unsubscribe Message
// ============================================

export const UnsubscribeMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('unsubscribe'),
  payload: z.object({
    projectId: z.string().uuid(),
  }),
});

export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessageSchema>;

export const UnsubscribedMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('unsubscribed'),
  payload: z.object({
    projectId: z.string().uuid(),
  }),
});

export type UnsubscribedMessage = z.infer<typeof UnsubscribedMessageSchema>;

// ============================================
// Context Update Messages (Client -> Server)
// ============================================

export const ContextUpdatePayloadSchema = z.object({
  entryId: z.string().uuid().optional(), // Optional for create
  operation: z.enum(['create', 'update', 'delete']),
  data: z.record(z.unknown()),
  baseVersion: z.number().optional(), // For optimistic concurrency
});

export const ContextUpdateMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('context_update'),
  payload: z.object({
    projectId: z.string().uuid(),
    updates: z.array(ContextUpdatePayloadSchema),
  }),
});

export type ContextUpdateMessage = z.infer<typeof ContextUpdateMessageSchema>;

// ============================================
// Context Changed Messages (Server -> Client)
// ============================================

export const ContextChangedMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('context_changed'),
  payload: z.object({
    projectId: z.string().uuid(),
    entityType: z.string(),
    entityId: z.string().uuid(),
    eventType: z.enum(['create', 'update', 'delete']),
    data: z.record(z.unknown()),
    userId: z.string().uuid().nullable(), // Who made the change
    userName: z.string().nullable(),
    sequenceNumber: z.bigint(),
    version: z.number().nullable(),
  }),
});

export type ContextChangedMessage = z.infer<typeof ContextChangedMessageSchema>;

// ============================================
// Presence Messages
// ============================================

export const PresenceUpdateMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('presence_update'),
  payload: z.object({
    projectId: z.string().uuid(),
    presence: UserPresenceSchema.partial().extend({
      status: PresenceStatusSchema,
    }),
  }),
});

export type PresenceUpdateMessage = z.infer<typeof PresenceUpdateMessageSchema>;

export const PresenceChangedMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('presence_changed'),
  payload: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    presence: UserPresenceSchema,
    action: z.enum(['joined', 'left', 'updated']),
  }),
});

export type PresenceChangedMessage = z.infer<typeof PresenceChangedMessageSchema>;

// ============================================
// Sync Request/Response (for offline mode)
// ============================================

export const SyncRequestMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('sync_request'),
  payload: z.object({
    projectId: z.string().uuid(),
    lastSequence: z.bigint(), // Last known sequence number
    pendingUpdates: z.array(ContextUpdatePayloadSchema), // Offline changes to push
  }),
});

export type SyncRequestMessage = z.infer<typeof SyncRequestMessageSchema>;

export const SyncResponseMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('sync_response'),
  payload: z.object({
    projectId: z.string().uuid(),
    currentSequence: z.bigint(),
    missedEvents: z.array(z.object({
      entityType: z.string(),
      entityId: z.string().uuid(),
      eventType: z.enum(['create', 'update', 'delete']),
      data: z.record(z.unknown()),
      userId: z.string().uuid().nullable(),
      sequenceNumber: z.bigint(),
      timestamp: z.number(),
    })),
    conflicts: z.array(ConflictInfoSchema),
    acceptedUpdates: z.array(z.string().uuid()), // IDs of accepted offline changes
    rejectedUpdates: z.array(z.object({
      id: z.string().uuid(),
      reason: z.string(),
    })),
  }),
});

export type SyncResponseMessage = z.infer<typeof SyncResponseMessageSchema>;

// ============================================
// Acknowledgment Message
// ============================================

export const AckMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('ack'),
  payload: z.object({
    messageId: z.string().uuid(), // ID of message being acknowledged
    success: z.boolean(),
    sequenceNumber: z.bigint().optional(),
    version: z.number().optional(),
    error: z.string().optional(),
  }),
});

export type AckMessage = z.infer<typeof AckMessageSchema>;

// ============================================
// Error Message
// ============================================

export const ErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'CONNECTION_ERROR',
  'SYNC_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('error'),
  payload: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    correlationId: z.string().uuid().optional(), // Original message ID if applicable
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// ============================================
// Heartbeat Message
// ============================================

export const HeartbeatMessageSchema = BaseSyncMessageSchema.extend({
  type: z.literal('heartbeat'),
  payload: z.object({
    serverTime: z.number(),
    latency: z.number().optional(), // RTT in ms if responding to client ping
  }),
});

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

// ============================================
// Union Type for All Messages
// ============================================

export const SyncMessageSchema = z.discriminatedUnion('type', [
  SubscribeMessageSchema,
  SubscribedMessageSchema,
  UnsubscribeMessageSchema,
  UnsubscribedMessageSchema,
  ContextUpdateMessageSchema,
  ContextChangedMessageSchema,
  PresenceUpdateMessageSchema,
  PresenceChangedMessageSchema,
  SyncRequestMessageSchema,
  SyncResponseMessageSchema,
  AckMessageSchema,
  ErrorMessageSchema,
  HeartbeatMessageSchema,
]);

export type SyncMessage = z.infer<typeof SyncMessageSchema>;

// ============================================
// Connected Client Type
// ============================================

export interface ConnectedClient {
  id: string;
  userId: string;
  userName: string;
  projectSubscriptions: Set<string>;
  presence: UserPresence;
  lastHeartbeat: number;
  connectionTime: number;
  metadata: Record<string, unknown>;
}

// ============================================
// Sync Service Configuration
// ============================================

export interface SyncServiceConfig {
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  maxReconnectAttempts: number;
  reconnectBackoffMs: number;
  maxEventBatchSize: number;
  eventRetentionMs: number;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  debounceMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncServiceConfig = {
  heartbeatIntervalMs: 30000,       // 30 seconds
  heartbeatTimeoutMs: 60000,        // 60 seconds
  maxReconnectAttempts: 5,
  reconnectBackoffMs: 1000,         // 1 second initial backoff
  maxEventBatchSize: 100,
  eventRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  conflictResolutionStrategy: 'last_write_wins',
  debounceMs: 500,
};
