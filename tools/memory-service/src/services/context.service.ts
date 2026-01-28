import { v4 as uuidv4 } from 'uuid';
import { getDatabase, withTransaction } from '../database/client.js';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import {
  ContextEntry,
  CreateContextEntry,
  UpdateContextEntry,
  SearchQuery,
  SearchResult,
  ContextEntryTypeSchema,
} from '../models/index.js';
import { EmbeddingService } from './embedding.service.js';

const logger = createChildLogger('context-service');

export class ContextService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async create(data: CreateContextEntry): Promise<ContextEntry> {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date();

    // Generate embedding for semantic search
    let embedding: number[] | null = null;
    try {
      embedding = await this.embeddingService.generateEmbedding(
        `${data.title}\n\n${data.content}`
      );
    } catch (error) {
      logger.warn({ error }, 'Failed to generate embedding, continuing without it');
    }

    const result = await db.query<ContextEntry>(
      `INSERT INTO context_entries (
        id, project_id, module_id, type, title, content, content_format,
        status, tags, metadata, embedding, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        data.projectId,
        data.moduleId,
        data.type,
        data.title,
        data.content,
        data.contentFormat ?? 'markdown',
        data.status ?? 'active',
        data.tags ?? [],
        JSON.stringify(data.metadata ?? {}),
        embedding ? `[${embedding.join(',')}]` : null,
        data.createdBy,
        data.createdBy,
        now,
        now,
      ]
    );

    const entry = this.mapRowToEntry(result.rows[0]);

    // Invalidate cache
    await this.invalidateCache(data.projectId);

    // Publish sync event
    await this.publishSyncEvent(data.projectId, id, 'create', entry);

    logger.info({ id, type: data.type, projectId: data.projectId }, 'Context entry created');

    return entry;
  }

  async update(data: UpdateContextEntry): Promise<ContextEntry> {
    return withTransaction(async (client) => {
      // Get current version for history
      const current = await this.getById(data.id);
      if (!current) {
        throw new Error(`Context entry not found: ${data.id}`);
      }

      // Save current version to history
      await client.query(
        `INSERT INTO context_entry_versions (id, entry_id, version, title, content, metadata, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          current.id,
          current.version,
          current.title,
          current.content,
          JSON.stringify(current.metadata),
          data.updatedBy,
        ]
      );

      // Generate new embedding if content changed
      let embedding: number[] | null = null;
      if (data.title || data.content) {
        try {
          const newTitle = data.title ?? current.title;
          const newContent = data.content ?? current.content;
          embedding = await this.embeddingService.generateEmbedding(
            `${newTitle}\n\n${newContent}`
          );
        } catch (error) {
          logger.warn({ error }, 'Failed to generate embedding on update');
        }
      }

      const updateFields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const addField = (field: string, value: unknown) => {
        if (value !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      };

      addField('title', data.title);
      addField('content', data.content);
      addField('content_format', data.contentFormat);
      addField('status', data.status);
      addField('tags', data.tags);
      addField('metadata', data.metadata ? JSON.stringify(data.metadata) : undefined);
      addField('module_id', data.moduleId);
      addField('superseded_by', data.supersededBy);
      addField('updated_by', data.updatedBy);

      if (embedding) {
        updateFields.push(`embedding = $${paramIndex}`);
        values.push(`[${embedding.join(',')}]`);
        paramIndex++;
      }

      updateFields.push(`version = version + 1`);
      updateFields.push(`updated_at = NOW()`);

      values.push(data.id);

      const result = await client.query<ContextEntry>(
        `UPDATE context_entries SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      const entry = this.mapRowToEntry(result.rows[0]);

      // Invalidate cache
      await this.invalidateCache(current.projectId);

      // Publish sync event
      await this.publishSyncEvent(current.projectId, data.id, 'update', entry);

      logger.info({ id: data.id }, 'Context entry updated');

      return entry;
    });
  }

  async delete(id: string, userId?: string): Promise<void> {
    const db = getDatabase();

    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Context entry not found: ${id}`);
    }

    await db.query('DELETE FROM context_entries WHERE id = $1', [id]);

    // Invalidate cache
    await this.invalidateCache(current.projectId);

    // Publish sync event
    await this.publishSyncEvent(current.projectId, id, 'delete', { id });

    logger.info({ id, userId }, 'Context entry deleted');
  }

  async getById(id: string): Promise<ContextEntry | null> {
    const cache = getCache();
    const cacheKey = `context:${id}`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ContextEntry;
    }

    const db = getDatabase();
    const result = await db.query<ContextEntry>(
      'SELECT * FROM context_entries WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const entry = this.mapRowToEntry(result.rows[0]);

    // Cache for 5 minutes
    await cache.set(cacheKey, JSON.stringify(entry), 300);

    return entry;
  }

  async getByProject(
    projectId: string,
    options: {
      type?: string;
      moduleId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: ContextEntry[]; total: number }> {
    const db = getDatabase();
    const conditions: string[] = ['project_id = $1'];
    const params: unknown[] = [projectId];
    let paramIndex = 2;

    if (options.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.moduleId) {
      conditions.push(`module_id = $${paramIndex}`);
      params.push(options.moduleId);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [countResult, dataResult] = await Promise.all([
      db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM context_entries WHERE ${whereClause}`,
        params
      ),
      db.query<ContextEntry>(
        `SELECT * FROM context_entries WHERE ${whereClause}
         ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
    ]);

    return {
      entries: dataResult.rows.map((row) => this.mapRowToEntry(row)),
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const db = getDatabase();

    if (query.semantic) {
      return this.semanticSearch(query);
    }

    // Text-based search with trigram similarity
    const result = await db.query<ContextEntry & { similarity: number }>(
      `SELECT *, similarity(title, $1) as similarity
       FROM context_entries
       WHERE project_id = $2
         AND status = 'active'
         AND (title ILIKE $3 OR content ILIKE $3)
       ORDER BY similarity DESC, updated_at DESC
       LIMIT $4 OFFSET $5`,
      [
        query.query,
        query.projectId,
        `%${query.query}%`,
        query.limit,
        query.offset,
      ]
    );

    return result.rows.map((row) => ({
      entry: this.mapRowToEntry(row),
      similarity: row.similarity,
      highlights: this.extractHighlights(row.content, query.query),
    }));
  }

  private async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    const db = getDatabase();

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query.query);

    if (!queryEmbedding) {
      logger.warn('Failed to generate query embedding, falling back to text search');
      return this.search({ ...query, semantic: false });
    }

    const result = await db.query<ContextEntry & { similarity: number }>(
      `SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM context_entries
       WHERE project_id = $2
         AND status = 'active'
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4 OFFSET $5`,
      [
        `[${queryEmbedding.join(',')}]`,
        query.projectId,
        query.minSimilarity,
        query.limit,
        query.offset,
      ]
    );

    return result.rows.map((row) => ({
      entry: this.mapRowToEntry(row),
      similarity: row.similarity,
      highlights: [],
    }));
  }

  private mapRowToEntry(row: Record<string, unknown>): ContextEntry {
    return {
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      moduleId: row['module_id'] as string | null,
      type: row['type'] as ContextEntry['type'],
      title: row['title'] as string,
      content: row['content'] as string,
      contentFormat: row['content_format'] as ContextEntry['contentFormat'],
      status: row['status'] as ContextEntry['status'],
      supersededBy: row['superseded_by'] as string | null,
      tags: row['tags'] as string[],
      metadata: (row['metadata'] as Record<string, unknown>) ?? {},
      embedding: null, // Don't expose embedding
      version: row['version'] as number,
      createdBy: row['created_by'] as string | null,
      updatedBy: row['updated_by'] as string | null,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }

  private extractHighlights(content: string, query: string): string[] {
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    const highlights: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes(queryLower)) {
        highlights.push(line.trim());
        if (highlights.length >= 3) break;
      }
    }

    return highlights;
  }

  private async invalidateCache(projectId: string): Promise<void> {
    const cache = getCache();
    const keys = await cache.keys(`context:*`);
    for (const key of keys) {
      await cache.del(key);
    }
    await cache.del(`project:${projectId}:entries`);
  }

  private async publishSyncEvent(
    projectId: string,
    entityId: string,
    eventType: 'create' | 'update' | 'delete',
    payload: unknown
  ): Promise<void> {
    const db = getDatabase();
    const cache = getCache();

    // Store event in database
    await db.query(
      `INSERT INTO sync_events (id, project_id, entity_type, entity_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), projectId, 'context_entry', entityId, eventType, JSON.stringify(payload)]
    );

    // Publish to Redis for real-time sync
    await cache.publish(`sync:${projectId}`, JSON.stringify({
      type: 'context_entry',
      event: eventType,
      id: entityId,
      payload,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Singleton instance
let contextService: ContextService | null = null;

export function getContextService(): ContextService {
  if (!contextService) {
    contextService = new ContextService();
  }
  return contextService;
}
