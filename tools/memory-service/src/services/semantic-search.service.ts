import { createHash } from 'crypto';
import { getDatabase } from '../database/client.js';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import {
  SearchQuery,
  SearchResult,
  SearchResponse,
  SearchHighlight,
  ContextEntry,
} from '../models/index.js';
import { EmbeddingService } from './embedding.service.js';

const logger = createChildLogger('semantic-search-service');

// Cache TTL configuration
const SEARCH_CACHE_TTL = 300; // 5 minutes
const EMBEDDING_CACHE_TTL = 86400; // 24 hours

// Performance thresholds (ms)
const PERFORMANCE_WARNING_THRESHOLD = 200;
const PERFORMANCE_CRITICAL_THRESHOLD = 500;

export class SemanticSearchService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Main search entry point supporting both semantic and text-based search
   * Implements caching, filtering, and performance monitoring
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(query);

    // Check cache first
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      const took = Math.round(performance.now() - startTime);
      logger.debug({ query: query.query, took, cached: true }, 'Search cache hit');
      return { ...cachedResult, took, cached: true };
    }

    let results: SearchResult[];
    let total: number;

    if (query.semantic) {
      const searchResult = await this.semanticSearch(query);
      results = searchResult.results;
      total = searchResult.total;
    } else {
      const searchResult = await this.textSearch(query);
      results = searchResult.results;
      total = searchResult.total;
    }

    // Add highlights if requested
    if (query.includeHighlights) {
      results = await this.addHighlights(results, query.query, query.semantic);
    }

    const took = Math.round(performance.now() - startTime);

    // Log performance metrics
    this.logPerformanceMetrics(query, took, results.length);

    const response: SearchResponse = {
      results,
      query: query.query,
      semantic: query.semantic,
      total,
      took,
      cached: false,
    };

    // Cache the result
    await this.cacheResult(cacheKey, response);

    return response;
  }

  /**
   * Semantic search using vector embeddings and pgvector
   */
  private async semanticSearch(
    query: SearchQuery
  ): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDatabase();

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query.query);

    if (!queryEmbedding) {
      logger.warn('Failed to generate query embedding, falling back to text search');
      return this.textSearch(query);
    }

    // Build dynamic WHERE clause with filters
    const { whereClause, params, paramIndex } = this.buildFilterClause(query, 2);
    params.unshift(`[${queryEmbedding.join(',')}]`); // $1 is the embedding

    // Count total matching results
    const countQuery = `
      SELECT COUNT(*) as count
      FROM context_entries
      WHERE project_id = $${paramIndex}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $${paramIndex + 1}
        ${whereClause}
    `;
    params.push(query.projectId, query.minSimilarity);

    const countResult = await db.query<{ count: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    // Main search query with ranking
    const searchQuery = `
      SELECT *,
             1 - (embedding <=> $1::vector) as similarity,
             ts_rank_cd(
               setweight(to_tsvector('english', title), 'A') ||
               setweight(to_tsvector('english', content), 'B'),
               plainto_tsquery('english', $${paramIndex + 2})
             ) as text_rank
      FROM context_entries
      WHERE project_id = $${paramIndex}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $${paramIndex + 1}
        ${whereClause}
      ORDER BY similarity DESC, text_rank DESC, updated_at DESC
      LIMIT $${paramIndex + 3} OFFSET $${paramIndex + 4}
    `;
    params.push(query.query, query.limit, query.offset);

    const result = await db.query<
      ContextEntry & { similarity: number; text_rank: number }
    >(searchQuery, params);

    return {
      results: result.rows.map((row) => ({
        entry: this.mapRowToEntry(row),
        similarity: row.similarity,
        highlights: [],
      })),
      total,
    };
  }

  /**
   * Text-based search using PostgreSQL trigram similarity and full-text search
   */
  private async textSearch(
    query: SearchQuery
  ): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDatabase();

    // Build dynamic WHERE clause with filters
    const { whereClause, params, paramIndex } = this.buildFilterClause(query, 2);
    params.unshift(query.query); // $1 is the query string

    // Count total matching results
    const countQuery = `
      SELECT COUNT(*) as count
      FROM context_entries
      WHERE project_id = $${paramIndex}
        AND (
          title ILIKE '%' || $1 || '%'
          OR content ILIKE '%' || $1 || '%'
          OR similarity(title, $1) > 0.1
        )
        ${whereClause}
    `;
    params.push(query.projectId);

    const countResult = await db.query<{ count: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    // Main search query with ranking
    const searchQuery = `
      SELECT *,
             GREATEST(
               similarity(title, $1),
               similarity(content, $1) * 0.5
             ) as similarity,
             ts_rank_cd(
               setweight(to_tsvector('english', title), 'A') ||
               setweight(to_tsvector('english', content), 'B'),
               plainto_tsquery('english', $1)
             ) as text_rank
      FROM context_entries
      WHERE project_id = $${paramIndex}
        AND (
          title ILIKE '%' || $1 || '%'
          OR content ILIKE '%' || $1 || '%'
          OR similarity(title, $1) > 0.1
        )
        ${whereClause}
      ORDER BY similarity DESC, text_rank DESC, updated_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;
    params.push(query.limit, query.offset);

    const result = await db.query<
      ContextEntry & { similarity: number; text_rank: number }
    >(searchQuery, params);

    return {
      results: result.rows.map((row) => ({
        entry: this.mapRowToEntry(row),
        similarity: row.similarity,
        highlights: [],
      })),
      total,
    };
  }

  /**
   * Build WHERE clause for filters
   */
  private buildFilterClause(
    query: SearchQuery,
    startParamIndex: number
  ): { whereClause: string; params: unknown[]; paramIndex: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = startParamIndex;

    // Status filter (default to 'active' if not specified)
    if (query.status && query.status.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(query.status);
      paramIndex++;
    } else {
      conditions.push(`status = 'active'`);
    }

    // Type filter
    if (query.types && query.types.length > 0) {
      conditions.push(`type = ANY($${paramIndex})`);
      params.push(query.types);
      paramIndex++;
    }

    // Tags filter (all tags must match)
    if (query.tags && query.tags.length > 0) {
      conditions.push(`tags @> $${paramIndex}`);
      params.push(query.tags);
      paramIndex++;
    }

    // Module filter
    if (query.moduleId) {
      conditions.push(`module_id = $${paramIndex}`);
      params.push(query.moduleId);
      paramIndex++;
    }

    // Author filter
    if (query.createdBy) {
      conditions.push(`created_by = $${paramIndex}`);
      params.push(query.createdBy);
      paramIndex++;
    }

    // Date range filters - created
    if (query.createdAfter) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(query.createdAfter);
      paramIndex++;
    }

    if (query.createdBefore) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(query.createdBefore);
      paramIndex++;
    }

    // Date range filters - updated
    if (query.updatedAfter) {
      conditions.push(`updated_at >= $${paramIndex}`);
      params.push(query.updatedAfter);
      paramIndex++;
    }

    if (query.updatedBefore) {
      conditions.push(`updated_at <= $${paramIndex}`);
      params.push(query.updatedBefore);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    return { whereClause, params, paramIndex };
  }

  /**
   * Add highlights to search results
   * For semantic search: uses key phrase extraction
   * For text search: highlights matching text
   */
  private async addHighlights(
    results: SearchResult[],
    query: string,
    semantic: boolean
  ): Promise<SearchResult[]> {
    const queryTerms = this.extractQueryTerms(query);

    return results.map((result) => {
      const highlights: SearchHighlight[] = [];

      // Extract title highlights
      const titleHighlights = this.findHighlightsInText(
        result.entry.title,
        queryTerms,
        'title',
        semantic
      );
      highlights.push(...titleHighlights);

      // Extract content highlights
      const contentHighlights = this.findHighlightsInText(
        result.entry.content,
        queryTerms,
        'content',
        semantic
      );
      highlights.push(...contentHighlights);

      return {
        ...result,
        highlights: highlights.slice(0, 5), // Limit to 5 highlights
      };
    });
  }

  /**
   * Find highlights in text
   */
  private findHighlightsInText(
    text: string,
    queryTerms: string[],
    field: 'title' | 'content',
    semantic: boolean
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const lines = text.split('\n');
    const seenTexts = new Set<string>();

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.length < 10) continue;

      const matchedTerms: string[] = [];

      for (const term of queryTerms) {
        if (trimmedLine.toLowerCase().includes(term.toLowerCase())) {
          matchedTerms.push(term);
        }
      }

      // For semantic search, also include lines with high semantic relevance
      // by checking for related terms and concepts
      if (semantic && matchedTerms.length === 0) {
        // Check for semantically related content (sentences containing key nouns/verbs)
        const hasRelevantContent = this.hasSemanticRelevance(trimmedLine, queryTerms);
        if (hasRelevantContent && highlights.length < 2) {
          // Include some semantic matches but limit them
          const normalizedText = trimmedLine.substring(0, 200);
          if (!seenTexts.has(normalizedText)) {
            seenTexts.add(normalizedText);
            highlights.push({
              field,
              text: normalizedText + (trimmedLine.length > 200 ? '...' : ''),
              matchedTerms: ['[semantic]'],
            });
          }
        }
        continue;
      }

      if (matchedTerms.length > 0) {
        const normalizedText = trimmedLine.substring(0, 200);
        if (!seenTexts.has(normalizedText)) {
          seenTexts.add(normalizedText);
          highlights.push({
            field,
            text: normalizedText + (trimmedLine.length > 200 ? '...' : ''),
            matchedTerms,
          });
        }
      }

      if (highlights.length >= 3) break;
    }

    return highlights;
  }

  /**
   * Check if a line has semantic relevance to query terms
   * Uses simple heuristics for related concepts
   */
  private hasSemanticRelevance(line: string, queryTerms: string[]): boolean {
    const lineLower = line.toLowerCase();

    // Check for partial matches or word stems
    for (const term of queryTerms) {
      const termLower = term.toLowerCase();
      // Check for word stem (e.g., "search" matches "searching", "searches")
      if (termLower.length >= 4) {
        const stem = termLower.substring(0, Math.min(termLower.length - 2, 6));
        if (lineLower.includes(stem)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract meaningful terms from query
   */
  private extractQueryTerms(query: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
      'if', 'or', 'because', 'until', 'while', 'about', 'against', 'between',
      'que', 'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las',
      'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'es', 'lo',
      'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha',
      'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay',
    ]);

    const terms = query
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length >= 3 && !stopWords.has(term));

    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Generate cache key for search query
   */
  private generateCacheKey(query: SearchQuery): string {
    const keyData = {
      q: query.query,
      p: query.projectId,
      t: query.types?.sort(),
      tags: query.tags?.sort(),
      m: query.moduleId,
      s: query.status?.sort(),
      cb: query.createdBy,
      ca: query.createdAfter?.toISOString(),
      cbe: query.createdBefore?.toISOString(),
      ua: query.updatedAfter?.toISOString(),
      ub: query.updatedBefore?.toISOString(),
      l: query.limit,
      o: query.offset,
      sem: query.semantic,
      min: query.minSimilarity,
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);

    return `search:${query.projectId}:${hash}`;
  }

  /**
   * Get cached search result
   */
  private async getCachedResult(cacheKey: string): Promise<SearchResponse | null> {
    try {
      const cache = getCache();
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SearchResponse;
      }
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Failed to get cached search result');
    }
    return null;
  }

  /**
   * Cache search result
   */
  private async cacheResult(cacheKey: string, response: SearchResponse): Promise<void> {
    try {
      const cache = getCache();
      // Don't cache empty results for long
      const ttl = response.results.length > 0 ? SEARCH_CACHE_TTL : 60;
      await cache.set(cacheKey, JSON.stringify(response), ttl);
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Failed to cache search result');
    }
  }

  /**
   * Invalidate search cache for a project
   */
  async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      const cache = getCache();
      const pattern = `search:${projectId}:*`;
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => cache.del(key)));
        logger.debug({ projectId, keysDeleted: keys.length }, 'Search cache invalidated');
      }
    } catch (error) {
      logger.warn({ error, projectId }, 'Failed to invalidate search cache');
    }
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(
    query: SearchQuery,
    took: number,
    resultCount: number
  ): void {
    const logData = {
      query: query.query.substring(0, 50),
      projectId: query.projectId,
      semantic: query.semantic,
      took,
      resultCount,
      filters: {
        types: query.types?.length ?? 0,
        tags: query.tags?.length ?? 0,
        hasDateFilter: !!(query.createdAfter || query.createdBefore),
        hasAuthorFilter: !!query.createdBy,
      },
    };

    if (took > PERFORMANCE_CRITICAL_THRESHOLD) {
      logger.error(logData, 'Search performance critical - exceeds 500ms');
    } else if (took > PERFORMANCE_WARNING_THRESHOLD) {
      logger.warn(logData, 'Search performance warning - exceeds 200ms');
    } else {
      logger.info(logData, 'Search completed');
    }
  }

  /**
   * Map database row to ContextEntry
   */
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

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(
    projectId: string,
    partialQuery: string,
    limit: number = 5
  ): Promise<string[]> {
    if (partialQuery.length < 2) return [];

    const db = getDatabase();
    const cache = getCache();
    const cacheKey = `suggestions:${projectId}:${partialQuery.toLowerCase()}`;

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get title suggestions using trigram similarity
    const result = await db.query<{ title: string }>(
      `SELECT DISTINCT title
       FROM context_entries
       WHERE project_id = $1
         AND status = 'active'
         AND (
           title ILIKE $2 || '%'
           OR title ILIKE '%' || $2 || '%'
         )
       ORDER BY
         CASE WHEN title ILIKE $2 || '%' THEN 0 ELSE 1 END,
         similarity(title, $2) DESC
       LIMIT $3`,
      [projectId, partialQuery, limit]
    );

    const suggestions = result.rows.map((row) => row.title);

    // Cache for 1 minute
    await cache.set(cacheKey, JSON.stringify(suggestions), 60);

    return suggestions;
  }

  /**
   * Get related entries based on an existing entry
   */
  async getRelatedEntries(
    entryId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    const db = getDatabase();

    // Get the entry's embedding
    const entryResult = await db.query<{
      embedding: string;
      project_id: string;
    }>(
      'SELECT embedding, project_id FROM context_entries WHERE id = $1',
      [entryId]
    );

    if (entryResult.rows.length === 0 || !entryResult.rows[0].embedding) {
      return [];
    }

    const { embedding, project_id: projectId } = entryResult.rows[0];

    // Find similar entries
    const result = await db.query<ContextEntry & { similarity: number }>(
      `SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM context_entries
       WHERE project_id = $2
         AND id != $3
         AND status = 'active'
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) >= 0.5
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [embedding, projectId, entryId, limit]
    );

    return result.rows.map((row) => ({
      entry: this.mapRowToEntry(row),
      similarity: row.similarity,
      highlights: [],
    }));
  }
}

// Singleton instance
let semanticSearchService: SemanticSearchService | null = null;

export function getSemanticSearchService(): SemanticSearchService {
  if (!semanticSearchService) {
    semanticSearchService = new SemanticSearchService();
  }
  return semanticSearchService;
}
