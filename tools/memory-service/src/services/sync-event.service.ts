import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/client.js';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import {
  QueuedSyncEvent,
  ContextChangedMessage,
  ConflictInfo,
  ConflictResolutionStrategy,
  DEFAULT_SYNC_CONFIG,
} from '../models/index.js';

const logger = createChildLogger('sync-event-service');

export interface SyncEventCreateInput {
  projectId: string;
  entityType: 'context_entry' | 'adr' | 'module' | 'project';
  entityId: string;
  eventType: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  userId: string | null;
  version?: number | null;
}

export interface PendingEventsQuery {
  projectId: string;
  afterSequence?: bigint;
  limit?: number;
  entityTypes?: string[];
}

export interface ConflictCheckInput {
  entryId: string;
  baseVersion: number;
  localTimestamp: number;
  localUserId: string;
}

/**
 * SyncEventService manages the event queue for real-time synchronization.
 *
 * Features:
 * - Persistent event storage with sequence numbers (event sourcing)
 * - Event retrieval for offline sync catch-up
 * - Redis-based real-time event broadcasting
 * - Conflict detection and resolution
 * - Event cleanup for old events
 */
export class SyncEventService {
  private readonly eventRetentionMs: number;

  constructor(config = DEFAULT_SYNC_CONFIG) {
    this.eventRetentionMs = config.eventRetentionMs;
  }

  /**
   * Create a new sync event and broadcast it.
   * Returns the sequence number assigned to the event.
   */
  async createEvent(input: SyncEventCreateInput): Promise<bigint> {
    const db = getDatabase();
    const cache = getCache();
    const id = uuidv4();
    const timestamp = Date.now();

    // Insert event and get assigned sequence number (auto-increment)
    const result = await db.query<{ sequence_number: string }>(
      `INSERT INTO sync_events (
        id, project_id, entity_type, entity_id, event_type, payload, user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0))
      RETURNING sequence_number`,
      [
        id,
        input.projectId,
        input.entityType,
        input.entityId,
        input.eventType,
        JSON.stringify(input.payload),
        input.userId,
        timestamp,
      ]
    );

    const sequenceNumber = BigInt(result.rows[0]!.sequence_number);

    // Broadcast to Redis for real-time delivery
    const broadcastMessage: ContextChangedMessage = {
      id: uuidv4(),
      type: 'context_changed',
      timestamp,
      payload: {
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        data: input.payload,
        userId: input.userId,
        userName: null, // Will be resolved by WebSocket handler
        sequenceNumber,
        version: input.version ?? null,
      },
    };

    await cache.publish(`sync:${input.projectId}`, JSON.stringify(broadcastMessage));

    logger.debug({
      id,
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      sequenceNumber: sequenceNumber.toString(),
    }, 'Sync event created and broadcast');

    return sequenceNumber;
  }

  /**
   * Get pending events after a given sequence number.
   * Used for catching up after reconnection (offline mode).
   */
  async getPendingEvents(query: PendingEventsQuery): Promise<QueuedSyncEvent[]> {
    const db = getDatabase();
    const limit = query.limit ?? 100;

    let sql = `
      SELECT
        id, project_id, entity_type, entity_id, event_type,
        payload, user_id, sequence_number, created_at
      FROM sync_events
      WHERE project_id = $1
    `;
    const params: unknown[] = [query.projectId];
    let paramIndex = 2;

    if (query.afterSequence !== undefined) {
      sql += ` AND sequence_number > $${paramIndex}`;
      params.push(query.afterSequence.toString());
      paramIndex++;
    }

    if (query.entityTypes && query.entityTypes.length > 0) {
      sql += ` AND entity_type = ANY($${paramIndex})`;
      params.push(query.entityTypes);
      paramIndex++;
    }

    sql += ` ORDER BY sequence_number ASC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query<Record<string, unknown>>(sql, params);

    return result.rows.map((row) => ({
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      entityType: row['entity_type'] as QueuedSyncEvent['entityType'],
      entityId: row['entity_id'] as string,
      eventType: row['event_type'] as QueuedSyncEvent['eventType'],
      payload: row['payload'] as Record<string, unknown>,
      userId: row['user_id'] as string | null,
      timestamp: new Date(row['created_at'] as string).getTime(),
      sequenceNumber: BigInt(row['sequence_number'] as string),
      version: null,
      processed: true,
      retryCount: 0,
    }));
  }

  /**
   * Get the current (latest) sequence number for a project.
   */
  async getCurrentSequence(projectId: string): Promise<bigint> {
    const db = getDatabase();

    const result = await db.query<{ max_seq: string | null }>(
      `SELECT MAX(sequence_number) as max_seq FROM sync_events WHERE project_id = $1`,
      [projectId]
    );

    return BigInt(result.rows[0]?.max_seq ?? '0');
  }

  /**
   * Check for conflicts when applying an update.
   * Compares base version with current server version.
   */
  async checkConflict(input: ConflictCheckInput): Promise<ConflictInfo | null> {
    const db = getDatabase();

    const result = await db.query<{
      version: number;
      updated_at: string;
      updated_by: string | null;
    }>(
      `SELECT version, updated_at, updated_by
       FROM context_entries
       WHERE id = $1`,
      [input.entryId]
    );

    if (result.rows.length === 0) {
      return null; // Entry doesn't exist
    }

    const serverEntry = result.rows[0]!;
    const serverVersion = serverEntry.version;
    const serverTimestamp = new Date(serverEntry.updated_at).getTime();

    // If versions match, no conflict
    if (serverVersion === input.baseVersion) {
      return null;
    }

    return {
      entryId: input.entryId,
      localVersion: input.baseVersion,
      serverVersion,
      localTimestamp: input.localTimestamp,
      serverTimestamp,
      localUserId: input.localUserId,
      serverUserId: serverEntry.updated_by ?? '',
      resolution: 'last_write_wins',
      resolved: false,
    };
  }

  /**
   * Resolve a conflict using the specified strategy.
   */
  resolveConflict(
    conflict: ConflictInfo,
    strategy: ConflictResolutionStrategy = 'last_write_wins'
  ): { shouldApply: boolean; resolvedConflict: ConflictInfo } {
    const resolvedConflict = { ...conflict, resolution: strategy, resolved: true };

    switch (strategy) {
      case 'last_write_wins':
        // Most recent timestamp wins
        return {
          shouldApply: conflict.localTimestamp > conflict.serverTimestamp,
          resolvedConflict,
        };

      case 'first_write_wins':
        // Original update wins (server always wins since it was first)
        return {
          shouldApply: false,
          resolvedConflict,
        };

      case 'manual':
        // Don't auto-resolve, queue for manual resolution
        return {
          shouldApply: false,
          resolvedConflict: { ...resolvedConflict, resolved: false },
        };

      case 'merge':
        // For now, fallback to last-write-wins
        // Full merge logic would require field-level comparison
        return {
          shouldApply: conflict.localTimestamp > conflict.serverTimestamp,
          resolvedConflict,
        };

      default:
        return {
          shouldApply: false,
          resolvedConflict,
        };
    }
  }

  /**
   * Get events within a time range (for audit purposes).
   */
  async getEventsByTimeRange(
    projectId: string,
    startTime: Date,
    endTime: Date,
    limit = 1000
  ): Promise<QueuedSyncEvent[]> {
    const db = getDatabase();

    const result = await db.query<Record<string, unknown>>(
      `SELECT
        id, project_id, entity_type, entity_id, event_type,
        payload, user_id, sequence_number, created_at
       FROM sync_events
       WHERE project_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY sequence_number ASC
       LIMIT $4`,
      [projectId, startTime, endTime, limit]
    );

    return result.rows.map((row) => ({
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      entityType: row['entity_type'] as QueuedSyncEvent['entityType'],
      entityId: row['entity_id'] as string,
      eventType: row['event_type'] as QueuedSyncEvent['eventType'],
      payload: row['payload'] as Record<string, unknown>,
      userId: row['user_id'] as string | null,
      timestamp: new Date(row['created_at'] as string).getTime(),
      sequenceNumber: BigInt(row['sequence_number'] as string),
      version: null,
      processed: true,
      retryCount: 0,
    }));
  }

  /**
   * Cleanup old events beyond retention period.
   * Should be run periodically (e.g., via cron job).
   */
  async cleanupOldEvents(): Promise<number> {
    const db = getDatabase();
    const cutoffTime = new Date(Date.now() - this.eventRetentionMs);

    const result = await db.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM sync_events
        WHERE created_at < $1
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted`,
      [cutoffTime]
    );

    const deletedCount = parseInt(result.rows[0]?.count ?? '0', 10);

    if (deletedCount > 0) {
      logger.info({ deletedCount, cutoffTime }, 'Cleaned up old sync events');
    }

    return deletedCount;
  }

  /**
   * Get summary statistics for sync events.
   */
  async getStats(projectId: string): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    latestSequence: bigint;
    oldestEventTime: Date | null;
    newestEventTime: Date | null;
  }> {
    const db = getDatabase();

    const [totalResult, byTypeResult, sequenceResult, timeResult] = await Promise.all([
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM sync_events WHERE project_id = $1`,
        [projectId]
      ),
      db.query<{ event_type: string; count: string }>(
        `SELECT event_type, COUNT(*) as count
         FROM sync_events
         WHERE project_id = $1
         GROUP BY event_type`,
        [projectId]
      ),
      db.query<{ max_seq: string | null }>(
        `SELECT MAX(sequence_number) as max_seq FROM sync_events WHERE project_id = $1`,
        [projectId]
      ),
      db.query<{ oldest: string | null; newest: string | null }>(
        `SELECT MIN(created_at) as oldest, MAX(created_at) as newest
         FROM sync_events
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    const eventsByType: Record<string, number> = {};
    for (const row of byTypeResult.rows) {
      eventsByType[row.event_type] = parseInt(row.count, 10);
    }

    return {
      totalEvents: parseInt(totalResult.rows[0]?.count ?? '0', 10),
      eventsByType,
      latestSequence: BigInt(sequenceResult.rows[0]?.max_seq ?? '0'),
      oldestEventTime: timeResult.rows[0]?.oldest
        ? new Date(timeResult.rows[0].oldest)
        : null,
      newestEventTime: timeResult.rows[0]?.newest
        ? new Date(timeResult.rows[0].newest)
        : null,
    };
  }
}

// Singleton instance
let syncEventService: SyncEventService | null = null;

export function getSyncEventService(): SyncEventService {
  if (!syncEventService) {
    syncEventService = new SyncEventService();
  }
  return syncEventService;
}
