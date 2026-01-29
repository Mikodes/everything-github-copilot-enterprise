import { describe, it, expect } from 'vitest';
import {
  SyncMessageSchema,
  SubscribeMessageSchema,
  ContextUpdateMessageSchema,
  PresenceUpdateMessageSchema,
  SyncRequestMessageSchema,
  UserPresenceSchema,
  ConflictInfoSchema,
  QueuedSyncEventSchema,
  ErrorCodeSchema,
  SyncServiceConfig,
  DEFAULT_SYNC_CONFIG,
} from '../../src/models/sync.js';

describe('Sync Models', () => {
  describe('UserPresenceSchema', () => {
    it('should validate a valid user presence', () => {
      const presence = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        userName: 'Test User',
        status: 'online',
        currentModule: null,
        currentEntry: null,
        lastActivity: Date.now(),
        metadata: {},
      };

      const result = UserPresenceSchema.safeParse(presence);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const presence = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        userName: 'Test User',
        status: 'invalid-status',
        currentModule: null,
        currentEntry: null,
        lastActivity: Date.now(),
        metadata: {},
      };

      const result = UserPresenceSchema.safeParse(presence);
      expect(result.success).toBe(false);
    });

    it('should accept all valid status values', () => {
      const statuses = ['online', 'editing', 'viewing', 'idle', 'offline'];

      for (const status of statuses) {
        const presence = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          userName: 'Test',
          status,
          currentModule: null,
          currentEntry: null,
          lastActivity: Date.now(),
          metadata: {},
        };

        const result = UserPresenceSchema.safeParse(presence);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('SubscribeMessageSchema', () => {
    it('should validate a valid subscribe message', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscribe',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
        },
      };

      const result = SubscribeMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate subscribe message with lastSequence', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscribe',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          lastSequence: BigInt(100),
        },
      };

      const result = SubscribeMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate subscribe message with modules filter', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscribe',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          modules: [
            '123e4567-e89b-12d3-a456-426614174002',
            '123e4567-e89b-12d3-a456-426614174003',
          ],
        },
      };

      const result = SubscribeMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('ContextUpdateMessageSchema', () => {
    it('should validate a valid create update message', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'context_update',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          updates: [
            {
              operation: 'create',
              data: {
                type: 'adr',
                title: 'New ADR',
                content: '# Content',
              },
            },
          ],
        },
      };

      const result = ContextUpdateMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate an update operation with baseVersion', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'context_update',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          updates: [
            {
              entryId: '123e4567-e89b-12d3-a456-426614174002',
              operation: 'update',
              baseVersion: 1,
              data: {
                title: 'Updated Title',
              },
            },
          ],
        },
      };

      const result = ContextUpdateMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate a delete operation', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'context_update',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          updates: [
            {
              entryId: '123e4567-e89b-12d3-a456-426614174002',
              operation: 'delete',
              data: {},
            },
          ],
        },
      };

      const result = ContextUpdateMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('PresenceUpdateMessageSchema', () => {
    it('should validate a valid presence update', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'presence_update',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          presence: {
            status: 'editing',
            currentEntry: '123e4567-e89b-12d3-a456-426614174002',
          },
        },
      };

      const result = PresenceUpdateMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('SyncRequestMessageSchema', () => {
    it('should validate a valid sync request for offline catch-up', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'sync_request',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          lastSequence: BigInt(50),
          pendingUpdates: [
            {
              operation: 'update',
              entryId: '123e4567-e89b-12d3-a456-426614174002',
              baseVersion: 2,
              data: { title: 'Offline edit' },
            },
          ],
        },
      };

      const result = SyncRequestMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('ConflictInfoSchema', () => {
    it('should validate a valid conflict info', () => {
      const conflict = {
        entryId: '123e4567-e89b-12d3-a456-426614174000',
        localVersion: 1,
        serverVersion: 2,
        localTimestamp: Date.now() - 1000,
        serverTimestamp: Date.now(),
        localUserId: '123e4567-e89b-12d3-a456-426614174001',
        serverUserId: '123e4567-e89b-12d3-a456-426614174002',
        resolution: 'last_write_wins',
        resolved: false,
      };

      const result = ConflictInfoSchema.safeParse(conflict);
      expect(result.success).toBe(true);
    });

    it('should validate all conflict resolution strategies', () => {
      const strategies = ['last_write_wins', 'first_write_wins', 'manual', 'merge'];

      for (const resolution of strategies) {
        const conflict = {
          entryId: '123e4567-e89b-12d3-a456-426614174000',
          localVersion: 1,
          serverVersion: 2,
          localTimestamp: Date.now(),
          serverTimestamp: Date.now(),
          localUserId: '123e4567-e89b-12d3-a456-426614174001',
          serverUserId: '123e4567-e89b-12d3-a456-426614174002',
          resolution,
          resolved: true,
        };

        const result = ConflictInfoSchema.safeParse(conflict);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('QueuedSyncEventSchema', () => {
    it('should validate a valid queued sync event', () => {
      const event = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        entityType: 'context_entry',
        entityId: '123e4567-e89b-12d3-a456-426614174002',
        eventType: 'create',
        payload: { title: 'New Entry', content: 'Content' },
        userId: '123e4567-e89b-12d3-a456-426614174003',
        timestamp: Date.now(),
        sequenceNumber: BigInt(1),
        version: 1,
        processed: false,
        retryCount: 0,
      };

      const result = QueuedSyncEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate all entity types', () => {
      const entityTypes = ['context_entry', 'adr', 'module', 'project'];

      for (const entityType of entityTypes) {
        const event = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          projectId: '123e4567-e89b-12d3-a456-426614174001',
          entityType,
          entityId: '123e4567-e89b-12d3-a456-426614174002',
          eventType: 'update',
          payload: {},
          userId: null,
          timestamp: Date.now(),
          sequenceNumber: BigInt(1),
          version: null,
          processed: true,
          retryCount: 0,
        };

        const result = QueuedSyncEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ErrorCodeSchema', () => {
    it('should validate all error codes', () => {
      const errorCodes = [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'VALIDATION_ERROR',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
        'CONNECTION_ERROR',
        'SYNC_ERROR',
      ];

      for (const code of errorCodes) {
        const result = ErrorCodeSchema.safeParse(code);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('SyncMessageSchema (discriminated union)', () => {
    it('should correctly discriminate subscribe message', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscribe',
        timestamp: Date.now(),
        payload: {
          projectId: '123e4567-e89b-12d3-a456-426614174001',
        },
      };

      const result = SyncMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('subscribe');
      }
    });

    it('should correctly discriminate error message', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'error',
        timestamp: Date.now(),
        payload: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };

      const result = SyncMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('error');
      }
    });

    it('should reject invalid message type', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'invalid_type',
        timestamp: Date.now(),
        payload: {},
      };

      const result = SyncMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });
  });

  describe('DEFAULT_SYNC_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_SYNC_CONFIG.heartbeatIntervalMs).toBe(30000);
      expect(DEFAULT_SYNC_CONFIG.heartbeatTimeoutMs).toBe(60000);
      expect(DEFAULT_SYNC_CONFIG.maxReconnectAttempts).toBe(5);
      expect(DEFAULT_SYNC_CONFIG.reconnectBackoffMs).toBe(1000);
      expect(DEFAULT_SYNC_CONFIG.maxEventBatchSize).toBe(100);
      expect(DEFAULT_SYNC_CONFIG.conflictResolutionStrategy).toBe('last_write_wins');
      expect(DEFAULT_SYNC_CONFIG.debounceMs).toBe(500);
    });

    it('should have event retention of 7 days', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(DEFAULT_SYNC_CONFIG.eventRetentionMs).toBe(sevenDaysMs);
    });
  });
});
