/**
 * US-004: Predictive Loader Service
 *
 * Implements intelligent cache preloading based on:
 * - Access frequency patterns
 * - Module dependencies
 * - User session context
 * - Time-based patterns (e.g., start of day, after PR merge)
 *
 * The goal is to have frequently accessed content already in L1 cache
 * before it's requested, reducing perceived latency to near-zero.
 */

import { getDatabase } from '../database/client.js';
import { getContextMultiCache, MultiLevelCache } from '../cache/multi-level-cache.js';
import { getCacheMetricsService, CacheMetricsService } from './cache-metrics.service.js';
import { createChildLogger } from '../utils/logger.js';
import { ContextEntry } from '../models/index.js';

const logger = createChildLogger('predictive-loader');

export interface PreloadConfig {
  enabled: boolean;
  intervalMs: number;
  maxPreloadItems: number;
  minAccessCount: number;
  moduleDepthLimit: number;
  preloadOnStartup: boolean;
}

export interface PreloadCandidate {
  key: string;
  entryId: string;
  projectId: string;
  score: number;
  reason: PreloadReason;
}

export type PreloadReason =
  | 'high_frequency'
  | 'recent_access'
  | 'module_dependency'
  | 'user_pattern'
  | 'startup_critical';

interface ModuleDependency {
  moduleId: string;
  dependsOn: string[];
  usedBy: string[];
}

export class PredictiveLoaderService {
  private cache: MultiLevelCache;
  private metrics: CacheMetricsService;
  private config: PreloadConfig;
  private preloadInterval: NodeJS.Timeout | null = null;
  private isPreloading = false;

  // Module dependency graph
  private moduleDependencies: Map<string, ModuleDependency> = new Map();

  // User session context (for per-user preloading)
  private userContexts: Map<string, {
    currentProject?: string;
    currentModule?: string;
    recentEntries: string[];
    lastActivity: number;
  }> = new Map();

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      intervalMs: config.intervalMs ?? 60000, // 1 minute
      maxPreloadItems: config.maxPreloadItems ?? 50,
      minAccessCount: config.minAccessCount ?? 3,
      moduleDepthLimit: config.moduleDepthLimit ?? 2,
      preloadOnStartup: config.preloadOnStartup ?? true,
    };

    this.cache = getContextMultiCache();
    this.metrics = getCacheMetricsService();

    logger.info({ config: this.config }, 'PredictiveLoaderService initialized');
  }

  /**
   * Start the predictive preloading background task
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Predictive loading is disabled');
      return;
    }

    if (this.preloadInterval) {
      logger.warn('Predictive loader already running');
      return;
    }

    // Run startup preload
    if (this.config.preloadOnStartup) {
      this.runPreloadCycle().catch(err => {
        logger.error({ err }, 'Startup preload failed');
      });
    }

    // Schedule periodic preloading
    this.preloadInterval = setInterval(() => {
      this.runPreloadCycle().catch(err => {
        logger.error({ err }, 'Preload cycle failed');
      });
    }, this.config.intervalMs);

    logger.info({ intervalMs: this.config.intervalMs }, 'Predictive loader started');
  }

  /**
   * Stop the predictive preloading background task
   */
  stop(): void {
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
      this.preloadInterval = null;
      logger.info('Predictive loader stopped');
    }
  }

  /**
   * Run a single preload cycle
   */
  async runPreloadCycle(): Promise<{ preloaded: number; candidates: number }> {
    if (this.isPreloading) {
      logger.debug('Preload cycle already in progress, skipping');
      return { preloaded: 0, candidates: 0 };
    }

    this.isPreloading = true;
    const startTime = Date.now();

    try {
      // Get preload candidates from multiple sources
      const candidates = await this.getPreloadCandidates();

      // Filter to top candidates
      const topCandidates = candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxPreloadItems);

      // Preload each candidate
      let preloadedCount = 0;
      for (const candidate of topCandidates) {
        try {
          const preloaded = await this.preloadEntry(candidate);
          if (preloaded) preloadedCount++;
        } catch (err) {
          logger.warn({ err, candidate }, 'Failed to preload candidate');
        }
      }

      const duration = Date.now() - startTime;
      logger.info({
        candidates: candidates.length,
        preloaded: preloadedCount,
        durationMs: duration,
      }, 'Preload cycle completed');

      return { preloaded: preloadedCount, candidates: candidates.length };
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Get all preload candidates from various sources
   */
  private async getPreloadCandidates(): Promise<PreloadCandidate[]> {
    const candidates: PreloadCandidate[] = [];

    // 1. High-frequency candidates from metrics
    const frequencyCandidates = this.getFrequencyCandidates();
    candidates.push(...frequencyCandidates);

    // 2. Module dependency candidates
    const dependencyCandidates = await this.getDependencyCandidates();
    candidates.push(...dependencyCandidates);

    // 3. User context candidates
    const userCandidates = this.getUserContextCandidates();
    candidates.push(...userCandidates);

    // 4. Critical entries (ADRs, project context)
    const criticalCandidates = await this.getCriticalCandidates();
    candidates.push(...criticalCandidates);

    // Deduplicate by entryId, keeping highest score
    const deduped = new Map<string, PreloadCandidate>();
    for (const candidate of candidates) {
      const existing = deduped.get(candidate.entryId);
      if (!existing || existing.score < candidate.score) {
        deduped.set(candidate.entryId, candidate);
      }
    }

    return Array.from(deduped.values());
  }

  /**
   * Get candidates based on access frequency
   */
  private getFrequencyCandidates(): PreloadCandidate[] {
    const predictive = this.metrics.getPredictiveMetrics();
    const candidates: PreloadCandidate[] = [];

    for (const { key, count } of predictive.topKeys) {
      if (count >= this.config.minAccessCount) {
        // Extract entryId and projectId from cache key
        const match = key.match(/^context:([^:]+):?(.*)$/);
        if (match) {
          candidates.push({
            key,
            entryId: match[1],
            projectId: match[2] || '',
            score: Math.min(1, count / 100), // Normalize to 0-1
            reason: 'high_frequency',
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Get candidates based on module dependencies
   */
  private async getDependencyCandidates(): Promise<PreloadCandidate[]> {
    const candidates: PreloadCandidate[] = [];

    // Get currently cached modules
    const cachedKeys = this.metrics.getPredictiveMetrics().recentAccesses
      .filter(a => a.contextType === 'module_context')
      .map(a => a.key);

    for (const key of cachedKeys.slice(-10)) { // Last 10 accessed modules
      const match = key.match(/^context:([^:]+)/);
      if (!match) continue;

      const entryId = match[1];
      const deps = this.moduleDependencies.get(entryId);
      if (!deps) continue;

      // Preload dependencies
      for (const depModuleId of deps.dependsOn.slice(0, this.config.moduleDepthLimit)) {
        candidates.push({
          key: `context:${depModuleId}`,
          entryId: depModuleId,
          projectId: '',
          score: 0.6,
          reason: 'module_dependency',
        });
      }
    }

    return candidates;
  }

  /**
   * Get candidates based on user session context
   */
  private getUserContextCandidates(): PreloadCandidate[] {
    const candidates: PreloadCandidate[] = [];
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [, context] of this.userContexts) {
      // Skip inactive sessions
      if (now - context.lastActivity > sessionTimeout) continue;

      // Preload recent entries for active users
      for (const entryId of context.recentEntries.slice(-5)) {
        candidates.push({
          key: `context:${entryId}`,
          entryId,
          projectId: context.currentProject || '',
          score: 0.7,
          reason: 'user_pattern',
        });
      }
    }

    return candidates;
  }

  /**
   * Get critical entries that should always be preloaded
   */
  private async getCriticalCandidates(): Promise<PreloadCandidate[]> {
    const db = getDatabase();
    const candidates: PreloadCandidate[] = [];

    try {
      // Get active project contexts and ADRs (critical for any operation)
      const result = await db.query<{ id: string; project_id: string; type: string }>(
        `SELECT id, project_id, type FROM context_entries
         WHERE status = 'active'
         AND type IN ('project_context', 'adr')
         ORDER BY updated_at DESC
         LIMIT 50`
      );

      for (const row of result.rows) {
        candidates.push({
          key: `context:${row.id}`,
          entryId: row.id,
          projectId: row.project_id,
          score: row.type === 'project_context' ? 0.9 : 0.8, // Project context is highest priority
          reason: 'startup_critical',
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to get critical candidates');
    }

    return candidates;
  }

  /**
   * Preload a single entry into L1 cache
   */
  private async preloadEntry(candidate: PreloadCandidate): Promise<boolean> {
    // Check if already in L1 cache
    const cached = await this.cache.get(candidate.key, undefined, { skipL2: true });
    if (cached.source === 'L1') {
      return false; // Already cached
    }

    const db = getDatabase();

    try {
      const result = await db.query<ContextEntry>(
        'SELECT * FROM context_entries WHERE id = $1',
        [candidate.entryId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const entry = this.mapRowToEntry(result.rows[0]);

      // Determine context type for TTL
      const contextType = this.mapEntryTypeToTTLType(entry.type);

      // Store in cache (this will populate both L1 and L2)
      await this.cache.set(candidate.key, entry, contextType);

      logger.debug({
        entryId: candidate.entryId,
        reason: candidate.reason,
        score: candidate.score,
      }, 'Entry preloaded');

      return true;
    } catch (err) {
      logger.warn({ err, candidate }, 'Failed to preload entry');
      return false;
    }
  }

  /**
   * Update user session context (called when user accesses entries)
   */
  updateUserContext(
    userId: string,
    entryId: string,
    projectId?: string,
    moduleId?: string
  ): void {
    let context = this.userContexts.get(userId);
    if (!context) {
      context = { recentEntries: [], lastActivity: Date.now() };
      this.userContexts.set(userId, context);
    }

    // Update context
    context.lastActivity = Date.now();
    if (projectId) context.currentProject = projectId;
    if (moduleId) context.currentModule = moduleId;

    // Add to recent entries (bounded)
    context.recentEntries.push(entryId);
    if (context.recentEntries.length > 50) {
      context.recentEntries.shift();
    }
  }

  /**
   * Register module dependencies for dependency-based preloading
   */
  registerModuleDependency(moduleId: string, dependsOn: string[]): void {
    let deps = this.moduleDependencies.get(moduleId);
    if (!deps) {
      deps = { moduleId, dependsOn: [], usedBy: [] };
      this.moduleDependencies.set(moduleId, deps);
    }

    deps.dependsOn = [...new Set([...deps.dependsOn, ...dependsOn])];

    // Update reverse dependencies
    for (const depId of dependsOn) {
      let depEntry = this.moduleDependencies.get(depId);
      if (!depEntry) {
        depEntry = { moduleId: depId, dependsOn: [], usedBy: [] };
        this.moduleDependencies.set(depId, depEntry);
      }
      if (!depEntry.usedBy.includes(moduleId)) {
        depEntry.usedBy.push(moduleId);
      }
    }
  }

  /**
   * Trigger immediate preload for a specific project
   */
  async preloadProject(projectId: string): Promise<number> {
    const db = getDatabase();
    let preloaded = 0;

    try {
      const result = await db.query<ContextEntry>(
        `SELECT * FROM context_entries
         WHERE project_id = $1 AND status = 'active'
         ORDER BY
           CASE type WHEN 'project_context' THEN 1 WHEN 'adr' THEN 2 ELSE 3 END,
           updated_at DESC
         LIMIT 100`,
        [projectId]
      );

      for (const row of result.rows) {
        const entry = this.mapRowToEntry(row);
        const key = `context:${entry.id}`;
        const contextType = this.mapEntryTypeToTTLType(entry.type);

        await this.cache.set(key, entry, contextType);
        preloaded++;
      }

      logger.info({ projectId, preloaded }, 'Project preloaded');
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to preload project');
    }

    return preloaded;
  }

  /**
   * Get preload statistics
   */
  getStats(): {
    isRunning: boolean;
    moduleDependenciesCount: number;
    activeUserSessions: number;
    nextPreloadIn: number | null;
  } {
    return {
      isRunning: this.preloadInterval !== null,
      moduleDependenciesCount: this.moduleDependencies.size,
      activeUserSessions: this.userContexts.size,
      nextPreloadIn: this.preloadInterval ? this.config.intervalMs : null,
    };
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
      embedding: null,
      version: row['version'] as number,
      createdBy: row['created_by'] as string | null,
      updatedBy: row['updated_by'] as string | null,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }

  private mapEntryTypeToTTLType(type: string): 'project_context' | 'module_context' | 'adr' | 'knowledge_entry' | 'session_context' {
    const mapping: Record<string, 'project_context' | 'module_context' | 'adr' | 'knowledge_entry' | 'session_context'> = {
      project_context: 'project_context',
      module_context: 'module_context',
      adr: 'adr',
      knowledge_entry: 'knowledge_entry',
      session_context: 'session_context',
    };
    return mapping[type] ?? 'knowledge_entry';
  }
}

// Singleton instance
let loaderInstance: PredictiveLoaderService | null = null;

export function getPredictiveLoaderService(config?: Partial<PreloadConfig>): PredictiveLoaderService {
  if (!loaderInstance) {
    loaderInstance = new PredictiveLoaderService(config);
  }
  return loaderInstance;
}

export function shutdownPredictiveLoader(): void {
  if (loaderInstance) {
    loaderInstance.stop();
    loaderInstance = null;
  }
}
