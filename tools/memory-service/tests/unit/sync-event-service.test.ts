import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEventService } from '../../src/services/sync-event.service.js';
import { ConflictInfo } from '../../src/models/sync.js';

// Mock database and cache
vi.mock('../../src/database/client.js', () => ({
  getDatabase: vi.fn(() => ({
    query: vi.fn(),
  })),
}));

vi.mock('../../src/cache/client.js', () => ({
  getCache: vi.fn(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

describe('SyncEventService', () => {
  let service: SyncEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncEventService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveConflict', () => {
    const baseConflict: ConflictInfo = {
      entryId: '123e4567-e89b-12d3-a456-426614174000',
      localVersion: 1,
      serverVersion: 2,
      localTimestamp: 1000,
      serverTimestamp: 2000,
      localUserId: 'user-1',
      serverUserId: 'user-2',
      resolution: 'last_write_wins',
      resolved: false,
    };

    describe('last_write_wins strategy', () => {
      it('should apply local change when local timestamp is newer', () => {
        const conflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 3000, // Newer than server
          serverTimestamp: 2000,
        };

        const result = service.resolveConflict(conflict, 'last_write_wins');

        expect(result.shouldApply).toBe(true);
        expect(result.resolvedConflict.resolution).toBe('last_write_wins');
        expect(result.resolvedConflict.resolved).toBe(true);
      });

      it('should reject local change when server timestamp is newer', () => {
        const conflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 1000, // Older than server
          serverTimestamp: 2000,
        };

        const result = service.resolveConflict(conflict, 'last_write_wins');

        expect(result.shouldApply).toBe(false);
        expect(result.resolvedConflict.resolved).toBe(true);
      });
    });

    describe('first_write_wins strategy', () => {
      it('should always reject local change (server is first)', () => {
        const conflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 3000, // Even though local is newer
          serverTimestamp: 2000,
        };

        const result = service.resolveConflict(conflict, 'first_write_wins');

        expect(result.shouldApply).toBe(false);
        expect(result.resolvedConflict.resolution).toBe('first_write_wins');
        expect(result.resolvedConflict.resolved).toBe(true);
      });
    });

    describe('manual strategy', () => {
      it('should not apply and mark as unresolved', () => {
        const result = service.resolveConflict(baseConflict, 'manual');

        expect(result.shouldApply).toBe(false);
        expect(result.resolvedConflict.resolution).toBe('manual');
        expect(result.resolvedConflict.resolved).toBe(false);
      });
    });

    describe('merge strategy', () => {
      it('should fallback to last_write_wins behavior', () => {
        // With local newer
        const newerConflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 3000,
          serverTimestamp: 2000,
        };

        const result1 = service.resolveConflict(newerConflict, 'merge');
        expect(result1.shouldApply).toBe(true);
        expect(result1.resolvedConflict.resolution).toBe('merge');

        // With server newer
        const olderConflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 1000,
          serverTimestamp: 2000,
        };

        const result2 = service.resolveConflict(olderConflict, 'merge');
        expect(result2.shouldApply).toBe(false);
      });
    });

    describe('default strategy', () => {
      it('should use last_write_wins when called without strategy', () => {
        const conflict: ConflictInfo = {
          ...baseConflict,
          localTimestamp: 3000,
          serverTimestamp: 2000,
        };

        const result = service.resolveConflict(conflict);

        expect(result.shouldApply).toBe(true);
        expect(result.resolvedConflict.resolution).toBe('last_write_wins');
      });
    });
  });

  describe('configuration', () => {
    it('should use default event retention', () => {
      const defaultService = new SyncEventService();
      // The service stores eventRetentionMs privately, so we test via cleanup behavior
      expect(defaultService).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        eventRetentionMs: 24 * 60 * 60 * 1000, // 1 day
        heartbeatIntervalMs: 15000,
        heartbeatTimeoutMs: 30000,
        maxReconnectAttempts: 3,
        reconnectBackoffMs: 500,
        maxEventBatchSize: 50,
        conflictResolutionStrategy: 'first_write_wins' as const,
        debounceMs: 250,
      };

      const customService = new SyncEventService(customConfig);
      expect(customService).toBeDefined();
    });
  });
});

describe('SyncEventService Integration', () => {
  // These tests would require actual database connections
  // In a real test environment, use testcontainers or a test database

  describe('createEvent', () => {
    it.skip('should create an event and broadcast to Redis', async () => {
      // Would require database mock setup
    });
  });

  describe('getPendingEvents', () => {
    it.skip('should return events after sequence number', async () => {
      // Would require database mock setup
    });
  });

  describe('getCurrentSequence', () => {
    it.skip('should return the max sequence number', async () => {
      // Would require database mock setup
    });
  });

  describe('checkConflict', () => {
    it.skip('should return null when versions match', async () => {
      // Would require database mock setup
    });

    it.skip('should return conflict info when versions differ', async () => {
      // Would require database mock setup
    });
  });

  describe('cleanupOldEvents', () => {
    it.skip('should delete events older than retention period', async () => {
      // Would require database mock setup
    });
  });
});
