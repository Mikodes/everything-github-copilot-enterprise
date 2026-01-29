/**
 * US-005: Automatic Context Detection Service
 *
 * Implements intelligent automatic context detection based on:
 * - AC-005.1: Current open file analysis
 * - AC-005.2: Session navigation history
 * - AC-005.3: Git branch context
 * - AC-005.4: User preference learning
 * - AC-005.5: Manual override support
 *
 * The goal is to automatically suggest relevant context to users
 * without them having to manually select it each time.
 */

import { getDatabase } from '../database/client.js';
import { getContextMultiCache, MultiLevelCache } from '../cache/multi-level-cache.js';
import { getCacheMetricsService, CacheMetricsService } from './cache-metrics.service.js';
import { getSemanticSearchService, SemanticSearchService } from './semantic-search.service.js';
import { createChildLogger } from '../utils/logger.js';
import { ContextEntry, SearchResult } from '../models/index.js';

const logger = createChildLogger('auto-context-detection');

// ============================================
// Types and Interfaces
// ============================================

export interface FileAnalysisResult {
  filePath: string;
  fileName: string;
  extension: string;
  language: string;
  directory: string;
  patterns: string[];
  moduleHints: string[];
}

export interface NavigationEvent {
  userId: string;
  filePath: string;
  projectId: string;
  moduleId?: string;
  timestamp: number;
  duration: number; // Time spent on file in ms
}

export interface GitContext {
  branch: string;
  recentCommits: string[];
  modifiedFiles: string[];
  isFeatureBranch: boolean;
  featureName?: string;
  ticketId?: string;
}

export interface UserPreference {
  userId: string;
  projectId: string;
  preferredContextTypes: Map<string, number>; // type -> weight
  preferredModules: Map<string, number>; // moduleId -> weight
  preferredTags: Map<string, number>; // tag -> weight
  fileTypeAssociations: Map<string, string[]>; // extension -> contextIds
  lastUpdated: number;
}

export interface DetectedContext {
  contextId: string;
  entry: ContextEntry;
  confidence: number; // 0-1
  reason: DetectionReason;
  source: DetectionSource;
}

export type DetectionReason =
  | 'file_pattern_match'
  | 'module_association'
  | 'git_branch_context'
  | 'navigation_history'
  | 'user_preference'
  | 'semantic_similarity'
  | 'tag_match'
  | 'explicit_override';

export type DetectionSource =
  | 'file_analyzer'
  | 'navigation_tracker'
  | 'git_integration'
  | 'preference_engine'
  | 'manual_override';

export interface DetectionRequest {
  userId: string;
  projectId: string;
  currentFile?: string;
  gitBranch?: string;
  gitModifiedFiles?: string[];
  additionalContext?: Record<string, unknown>;
}

export interface DetectionResponse {
  suggestedContexts: DetectedContext[];
  primaryContext: DetectedContext | null;
  alternativeContexts: DetectedContext[];
  metadata: {
    detectionTimeMs: number;
    sourcesUsed: DetectionSource[];
    overrideActive: boolean;
  };
}

export interface OverrideConfig {
  userId: string;
  projectId: string;
  contextIds: string[];
  expiresAt: number | null; // null = permanent until manually cleared
}

export interface AutoDetectionConfig {
  enabled: boolean;
  maxSuggestions: number;
  minConfidenceThreshold: number;
  navigationHistoryLimit: number;
  preferenceDecayFactor: number; // How quickly preferences decay
  semanticSearchWeight: number;
  filePatternWeight: number;
  gitContextWeight: number;
  userPreferenceWeight: number;
  navigationWeight: number;
}

// ============================================
// File Pattern Configurations
// ============================================

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  dockerfile: 'docker',
  tf: 'terraform',
  hcl: 'terraform',
};

const FILE_PATTERN_HINTS: Array<{ pattern: RegExp; hints: string[] }> = [
  { pattern: /\.test\.(ts|js|tsx|jsx)$/, hints: ['testing', 'unit-tests'] },
  { pattern: /\.spec\.(ts|js|tsx|jsx)$/, hints: ['testing', 'unit-tests'] },
  { pattern: /\.e2e\.(ts|js)$/, hints: ['testing', 'e2e-tests'] },
  { pattern: /controller\.(ts|js)$/, hints: ['api', 'controller', 'http'] },
  { pattern: /service\.(ts|js)$/, hints: ['service', 'business-logic'] },
  { pattern: /repository\.(ts|js)$/, hints: ['database', 'repository'] },
  { pattern: /model\.(ts|js)$/, hints: ['model', 'data'] },
  { pattern: /schema\.(ts|js)$/, hints: ['schema', 'validation'] },
  { pattern: /route[s]?\.(ts|js)$/, hints: ['api', 'routes', 'http'] },
  { pattern: /middleware\.(ts|js)$/, hints: ['middleware', 'http'] },
  { pattern: /hook[s]?\.(ts|tsx)$/, hints: ['react', 'hooks'] },
  { pattern: /\/hooks?\/.*\.(ts|tsx)$/, hints: ['react', 'hooks'] },
  { pattern: /\/use[A-Z][^/]*\.(ts|tsx)$/, hints: ['react', 'hooks'] },
  { pattern: /component[s]?\.(tsx|jsx)$/, hints: ['react', 'ui', 'component'] },
  { pattern: /\/components?\/.*\.(tsx|jsx)$/, hints: ['react', 'ui', 'component'] },
  { pattern: /util[s]?\.(ts|js)$/, hints: ['utilities', 'helpers'] },
  { pattern: /helper[s]?\.(ts|js)$/, hints: ['utilities', 'helpers'] },
  { pattern: /config\.(ts|js|json|yaml)$/, hints: ['configuration'] },
  { pattern: /migration\.(ts|js|sql)$/, hints: ['database', 'migration'] },
  { pattern: /seed\.(ts|js)$/, hints: ['database', 'seed'] },
  { pattern: /dockerfile/i, hints: ['docker', 'deployment'] },
  { pattern: /docker-compose/i, hints: ['docker', 'deployment', 'orchestration'] },
  { pattern: /\.github\/workflows\//i, hints: ['ci-cd', 'github-actions'] },
  { pattern: /terraform\//i, hints: ['infrastructure', 'terraform'] },
  { pattern: /README\.md$/i, hints: ['documentation'] },
  { pattern: /CHANGELOG\.md$/i, hints: ['documentation', 'changelog'] },
  { pattern: /ADR-\d+/i, hints: ['adr', 'architecture'] },
];

const DIRECTORY_MODULE_HINTS: Array<{ pattern: RegExp; module: string }> = [
  { pattern: /\/src\/api\//i, module: 'api' },
  { pattern: /\/src\/services?\//i, module: 'services' },
  { pattern: /\/src\/controllers?\//i, module: 'controllers' },
  { pattern: /\/src\/models?\//i, module: 'models' },
  { pattern: /\/src\/components?\//i, module: 'ui-components' },
  { pattern: /\/src\/hooks?\//i, module: 'react-hooks' },
  { pattern: /\/src\/utils?\//i, module: 'utilities' },
  { pattern: /\/src\/lib\//i, module: 'library' },
  { pattern: /\/src\/database\//i, module: 'database' },
  { pattern: /\/src\/cache\//i, module: 'caching' },
  { pattern: /\/tests?\//i, module: 'testing' },
  { pattern: /\/e2e\//i, module: 'e2e-testing' },
  { pattern: /\/infra(structure)?\//i, module: 'infrastructure' },
  { pattern: /\/deploy(ment)?\//i, module: 'deployment' },
  { pattern: /\/docs?\//i, module: 'documentation' },
];

const GIT_BRANCH_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /^feature\/(.+)$/, type: 'feature' },
  { pattern: /^feat\/(.+)$/, type: 'feature' },
  { pattern: /^bugfix\/(.+)$/, type: 'bugfix' },
  { pattern: /^fix\/(.+)$/, type: 'bugfix' },
  { pattern: /^hotfix\/(.+)$/, type: 'hotfix' },
  { pattern: /^release\/(.+)$/, type: 'release' },
  { pattern: /^chore\/(.+)$/, type: 'chore' },
  { pattern: /^refactor\/(.+)$/, type: 'refactor' },
  { pattern: /^docs?\/(.+)$/, type: 'documentation' },
  { pattern: /^test\/(.+)$/, type: 'testing' },
];

const TICKET_ID_PATTERNS = [
  /([A-Z]+-\d+)/i, // JIRA style: PROJ-123
  /#(\d+)/, // GitHub issue: #123
  /GH-(\d+)/i, // GitHub: GH-123
  /ADO-(\d+)/i, // Azure DevOps: ADO-123
];

// ============================================
// Main Service Class
// ============================================

export class AutoContextDetectionService {
  private cache: MultiLevelCache;
  private metrics: CacheMetricsService;
  private searchService: SemanticSearchService;
  private config: AutoDetectionConfig;

  // In-memory stores
  private navigationHistory: Map<string, NavigationEvent[]> = new Map();
  private userPreferences: Map<string, UserPreference> = new Map();
  private activeOverrides: Map<string, OverrideConfig> = new Map();
  private sessionContexts: Map<string, Map<string, number>> = new Map(); // userId -> contextId -> accessCount

  constructor(config: Partial<AutoDetectionConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxSuggestions: config.maxSuggestions ?? 5,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.3,
      navigationHistoryLimit: config.navigationHistoryLimit ?? 100,
      preferenceDecayFactor: config.preferenceDecayFactor ?? 0.95,
      semanticSearchWeight: config.semanticSearchWeight ?? 0.3,
      filePatternWeight: config.filePatternWeight ?? 0.25,
      gitContextWeight: config.gitContextWeight ?? 0.2,
      userPreferenceWeight: config.userPreferenceWeight ?? 0.15,
      navigationWeight: config.navigationWeight ?? 0.1,
    };

    this.cache = getContextMultiCache();
    this.metrics = getCacheMetricsService();
    this.searchService = getSemanticSearchService();

    logger.info({ config: this.config }, 'AutoContextDetectionService initialized');
  }

  // ============================================
  // T-005.1: File Analyzer
  // ============================================

  /**
   * Analyze a file path to extract context hints
   */
  analyzeFile(filePath: string): FileAnalysisResult {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    const fileName = parts[parts.length - 1] || '';
    const directory = parts.slice(0, -1).join('/');

    // Extract extension
    const extensionMatch = fileName.match(/\.([^.]+)$/);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

    // Determine language
    const language = LANGUAGE_EXTENSIONS[extension] || 'unknown';

    // Find pattern-based hints
    const patterns: string[] = [];
    for (const { pattern, hints } of FILE_PATTERN_HINTS) {
      if (pattern.test(normalizedPath)) {
        patterns.push(...hints);
      }
    }

    // Find module hints from directory
    const moduleHints: string[] = [];
    for (const { pattern, module } of DIRECTORY_MODULE_HINTS) {
      if (pattern.test(normalizedPath)) {
        moduleHints.push(module);
      }
    }

    return {
      filePath: normalizedPath,
      fileName,
      extension,
      language,
      directory,
      patterns: [...new Set(patterns)],
      moduleHints: [...new Set(moduleHints)],
    };
  }

  /**
   * Find contexts matching file analysis
   */
  async findContextsForFile(
    projectId: string,
    fileAnalysis: FileAnalysisResult
  ): Promise<DetectedContext[]> {
    const db = getDatabase();
    const contexts: DetectedContext[] = [];

    // Build search terms from file analysis
    const searchTerms = [
      ...fileAnalysis.patterns,
      ...fileAnalysis.moduleHints,
      fileAnalysis.language,
    ].filter(Boolean);

    if (searchTerms.length === 0) {
      return contexts;
    }

    // Search by tags
    const tagQuery = `
      SELECT * FROM context_entries
      WHERE project_id = $1
        AND status = 'active'
        AND tags && $2::text[]
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    try {
      const result = await db.query<ContextEntry>(tagQuery, [projectId, searchTerms]);

      for (const row of result.rows) {
        const entry = this.mapRowToEntry(row);
        const matchingTags = entry.tags.filter(t => searchTerms.includes(t));
        const confidence = Math.min(0.9, 0.4 + (matchingTags.length * 0.15));

        contexts.push({
          contextId: entry.id,
          entry,
          confidence,
          reason: 'file_pattern_match',
          source: 'file_analyzer',
        });
      }
    } catch (err) {
      logger.warn({ err, projectId }, 'Failed to search contexts by tags');
    }

    // Also search by module path hints
    if (fileAnalysis.moduleHints.length > 0) {
      try {
        const moduleQuery = `
          SELECT ce.* FROM context_entries ce
          JOIN modules m ON ce.module_id = m.id
          WHERE ce.project_id = $1
            AND ce.status = 'active'
            AND (m.name ILIKE ANY($2) OR m.path ILIKE ANY($3))
          ORDER BY ce.updated_at DESC
          LIMIT 5
        `;

        const modulePatterns = fileAnalysis.moduleHints.map(h => `%${h}%`);
        const result = await db.query<ContextEntry>(moduleQuery, [
          projectId,
          modulePatterns,
          modulePatterns,
        ]);

        for (const row of result.rows) {
          const entry = this.mapRowToEntry(row);
          // Don't duplicate
          if (!contexts.find(c => c.contextId === entry.id)) {
            contexts.push({
              contextId: entry.id,
              entry,
              confidence: 0.6,
              reason: 'module_association',
              source: 'file_analyzer',
            });
          }
        }
      } catch (err) {
        logger.warn({ err, projectId }, 'Failed to search contexts by module');
      }
    }

    return contexts;
  }

  // ============================================
  // T-005.2: Navigation Tracker
  // ============================================

  /**
   * Record a navigation event (user opened a file)
   */
  recordNavigation(event: NavigationEvent): void {
    const key = `${event.userId}:${event.projectId}`;
    let history = this.navigationHistory.get(key);

    if (!history) {
      history = [];
      this.navigationHistory.set(key, history);
    }

    history.push(event);

    // Trim to limit
    if (history.length > this.config.navigationHistoryLimit) {
      history.shift();
    }

    // Update session context tracking
    this.updateSessionContext(event.userId, event.filePath, event.projectId);

    logger.debug({ event }, 'Navigation recorded');
  }

  /**
   * Get navigation history for a user/project
   */
  getNavigationHistory(userId: string, projectId: string): NavigationEvent[] {
    const key = `${userId}:${projectId}`;
    return this.navigationHistory.get(key) || [];
  }

  /**
   * Find contexts based on navigation patterns
   */
  async findContextsFromNavigation(
    userId: string,
    projectId: string
  ): Promise<DetectedContext[]> {
    const history = this.getNavigationHistory(userId, projectId);
    if (history.length === 0) return [];

    const contexts: DetectedContext[] = [];

    // Analyze frequent file patterns
    const filePatternCounts: Map<string, number> = new Map();
    const moduleAccessCounts: Map<string, number> = new Map();

    for (const event of history) {
      const analysis = this.analyzeFile(event.filePath);

      for (const pattern of analysis.patterns) {
        filePatternCounts.set(pattern, (filePatternCounts.get(pattern) || 0) + 1);
      }

      if (event.moduleId) {
        moduleAccessCounts.set(event.moduleId, (moduleAccessCounts.get(event.moduleId) || 0) + 1);
      }
    }

    // Find contexts matching frequent patterns
    const topPatterns = Array.from(filePatternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    if (topPatterns.length > 0) {
      const db = getDatabase();
      try {
        const result = await db.query<ContextEntry>(
          `SELECT * FROM context_entries
           WHERE project_id = $1 AND status = 'active' AND tags && $2::text[]
           ORDER BY updated_at DESC LIMIT 5`,
          [projectId, topPatterns]
        );

        for (const row of result.rows) {
          const entry = this.mapRowToEntry(row);
          contexts.push({
            contextId: entry.id,
            entry,
            confidence: 0.55,
            reason: 'navigation_history',
            source: 'navigation_tracker',
          });
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to find contexts from navigation');
      }
    }

    // Find contexts for frequently accessed modules
    const topModules = Array.from(moduleAccessCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([moduleId]) => moduleId);

    if (topModules.length > 0) {
      const db = getDatabase();
      try {
        const result = await db.query<ContextEntry>(
          `SELECT * FROM context_entries
           WHERE project_id = $1 AND status = 'active' AND module_id = ANY($2)
           ORDER BY updated_at DESC LIMIT 5`,
          [projectId, topModules]
        );

        for (const row of result.rows) {
          const entry = this.mapRowToEntry(row);
          if (!contexts.find(c => c.contextId === entry.id)) {
            contexts.push({
              contextId: entry.id,
              entry,
              confidence: 0.5,
              reason: 'navigation_history',
              source: 'navigation_tracker',
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to find contexts from module navigation');
      }
    }

    return contexts;
  }

  private updateSessionContext(userId: string, filePath: string, projectId: string): void {
    let userSession = this.sessionContexts.get(userId);
    if (!userSession) {
      userSession = new Map();
      this.sessionContexts.set(userId, userSession);
    }

    // Create a simple key from file path for tracking
    const contextKey = `${projectId}:${filePath}`;
    userSession.set(contextKey, (userSession.get(contextKey) || 0) + 1);
  }

  // ============================================
  // T-005.3: Git Integration
  // ============================================

  /**
   * Parse Git branch context
   */
  parseGitContext(
    branch: string,
    modifiedFiles: string[] = [],
    recentCommits: string[] = []
  ): GitContext {
    const context: GitContext = {
      branch,
      recentCommits,
      modifiedFiles,
      isFeatureBranch: false,
    };

    // Detect branch type and feature name
    for (const { pattern, type } of GIT_BRANCH_PATTERNS) {
      const match = branch.match(pattern);
      if (match) {
        context.isFeatureBranch = type === 'feature';
        context.featureName = match[1];
        break;
      }
    }

    // Extract ticket ID from branch name
    const branchTicket = this.extractTicketId(branch);
    if (branchTicket) {
      context.ticketId = branchTicket;
    }

    // Also check commit messages for ticket IDs
    if (!context.ticketId) {
      for (const commit of recentCommits.slice(0, 5)) {
        const ticketId = this.extractTicketId(commit);
        if (ticketId) {
          context.ticketId = ticketId;
          break;
        }
      }
    }

    return context;
  }

  private extractTicketId(text: string): string | undefined {
    for (const pattern of TICKET_ID_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Find contexts related to Git branch/changes
   */
  async findContextsFromGit(
    projectId: string,
    gitContext: GitContext
  ): Promise<DetectedContext[]> {
    const contexts: DetectedContext[] = [];
    const db = getDatabase();

    // Search for contexts related to ticket ID
    if (gitContext.ticketId) {
      try {
        const result = await db.query<ContextEntry>(
          `SELECT * FROM context_entries
           WHERE project_id = $1
             AND status = 'active'
             AND (
               content ILIKE $2
               OR title ILIKE $2
               OR metadata->>'ticketId' = $3
             )
           ORDER BY updated_at DESC LIMIT 5`,
          [projectId, `%${gitContext.ticketId}%`, gitContext.ticketId]
        );

        for (const row of result.rows) {
          const entry = this.mapRowToEntry(row);
          contexts.push({
            contextId: entry.id,
            entry,
            confidence: 0.85,
            reason: 'git_branch_context',
            source: 'git_integration',
          });
        }
      } catch (err) {
        logger.warn({ err, ticketId: gitContext.ticketId }, 'Failed to find contexts by ticket');
      }
    }

    // Search for contexts related to feature name
    if (gitContext.featureName) {
      try {
        const searchTerms = gitContext.featureName
          .split(/[-_/]/)
          .filter(term => term.length > 2);

        if (searchTerms.length > 0) {
          // Use semantic search for feature-related contexts
          const searchQuery = searchTerms.join(' ');
          const searchResults = await this.searchService.search({
            query: searchQuery,
            projectId,
            limit: 5,
            semantic: true,
            minSimilarity: 0.5,
          });

          for (const result of searchResults.results) {
            if (!contexts.find(c => c.contextId === result.entry.id)) {
              contexts.push({
                contextId: result.entry.id,
                entry: result.entry,
                confidence: Math.min(0.75, (result.similarity || 0.5) + 0.1),
                reason: 'git_branch_context',
                source: 'git_integration',
              });
            }
          }
        }
      } catch (err) {
        logger.warn({ err, featureName: gitContext.featureName }, 'Failed to find contexts by feature');
      }
    }

    // Analyze modified files for module context
    if (gitContext.modifiedFiles.length > 0) {
      const moduleHints: Set<string> = new Set();

      for (const file of gitContext.modifiedFiles.slice(0, 20)) {
        const analysis = this.analyzeFile(file);
        analysis.moduleHints.forEach(h => moduleHints.add(h));
      }

      if (moduleHints.size > 0) {
        try {
          const modulePatterns = Array.from(moduleHints).map(h => `%${h}%`);
          const result = await db.query<ContextEntry>(
            `SELECT ce.* FROM context_entries ce
             LEFT JOIN modules m ON ce.module_id = m.id
             WHERE ce.project_id = $1
               AND ce.status = 'active'
               AND (ce.tags && $2::text[] OR m.name ILIKE ANY($3))
             ORDER BY ce.updated_at DESC LIMIT 5`,
            [projectId, Array.from(moduleHints), modulePatterns]
          );

          for (const row of result.rows) {
            const entry = this.mapRowToEntry(row);
            if (!contexts.find(c => c.contextId === entry.id)) {
              contexts.push({
                contextId: entry.id,
                entry,
                confidence: 0.5,
                reason: 'git_branch_context',
                source: 'git_integration',
              });
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to find contexts from modified files');
        }
      }
    }

    return contexts;
  }

  // ============================================
  // T-005.4: User Preference Learning
  // ============================================

  /**
   * Update user preferences based on context access
   */
  updateUserPreference(
    userId: string,
    projectId: string,
    contextEntry: ContextEntry,
    accessWeight: number = 1
  ): void {
    const key = `${userId}:${projectId}`;
    let preference = this.userPreferences.get(key);

    if (!preference) {
      preference = {
        userId,
        projectId,
        preferredContextTypes: new Map(),
        preferredModules: new Map(),
        preferredTags: new Map(),
        fileTypeAssociations: new Map(),
        lastUpdated: Date.now(),
      };
      this.userPreferences.set(key, preference);
    }

    // Update type preference
    const currentTypeWeight = preference.preferredContextTypes.get(contextEntry.type) || 0;
    preference.preferredContextTypes.set(
      contextEntry.type,
      currentTypeWeight + accessWeight
    );

    // Update module preference
    if (contextEntry.moduleId) {
      const currentModuleWeight = preference.preferredModules.get(contextEntry.moduleId) || 0;
      preference.preferredModules.set(
        contextEntry.moduleId,
        currentModuleWeight + accessWeight
      );
    }

    // Update tag preferences
    for (const tag of contextEntry.tags) {
      const currentTagWeight = preference.preferredTags.get(tag) || 0;
      preference.preferredTags.set(tag, currentTagWeight + accessWeight);
    }

    preference.lastUpdated = Date.now();

    // Apply decay to prevent overfitting to recent behavior
    this.applyPreferenceDecay(preference);
  }

  private applyPreferenceDecay(preference: UserPreference): void {
    const decay = this.config.preferenceDecayFactor;

    for (const [key, value] of preference.preferredContextTypes) {
      preference.preferredContextTypes.set(key, value * decay);
    }

    for (const [key, value] of preference.preferredModules) {
      preference.preferredModules.set(key, value * decay);
    }

    for (const [key, value] of preference.preferredTags) {
      preference.preferredTags.set(key, value * decay);
    }
  }

  /**
   * Record file-to-context association for learning
   */
  recordFileContextAssociation(
    userId: string,
    projectId: string,
    fileExtension: string,
    contextId: string
  ): void {
    const key = `${userId}:${projectId}`;
    const preference = this.userPreferences.get(key);

    if (preference) {
      const associations = preference.fileTypeAssociations.get(fileExtension) || [];
      if (!associations.includes(contextId)) {
        associations.push(contextId);
        if (associations.length > 20) {
          associations.shift(); // Keep only recent associations
        }
        preference.fileTypeAssociations.set(fileExtension, associations);
      }
    }
  }

  /**
   * Find contexts based on learned user preferences
   */
  async findContextsFromPreferences(
    userId: string,
    projectId: string,
    currentFileExtension?: string
  ): Promise<DetectedContext[]> {
    const key = `${userId}:${projectId}`;
    const preference = this.userPreferences.get(key);

    if (!preference) return [];

    const contexts: DetectedContext[] = [];
    const db = getDatabase();

    // Get top preferred types
    const topTypes = Array.from(preference.preferredContextTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, weight]) => weight > 0.5)
      .map(([type]) => type);

    // Get top preferred modules
    const topModules = Array.from(preference.preferredModules.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, weight]) => weight > 0.5)
      .map(([moduleId]) => moduleId);

    // Get top preferred tags
    const topTags = Array.from(preference.preferredTags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter(([, weight]) => weight > 0.5)
      .map(([tag]) => tag);

    // Build query based on preferences
    if (topTypes.length > 0 || topModules.length > 0 || topTags.length > 0) {
      try {
        const conditions: string[] = ['project_id = $1', "status = 'active'"];
        const params: unknown[] = [projectId];
        let paramIndex = 2;

        const orConditions: string[] = [];

        if (topTypes.length > 0) {
          orConditions.push(`type = ANY($${paramIndex})`);
          params.push(topTypes);
          paramIndex++;
        }

        if (topModules.length > 0) {
          orConditions.push(`module_id = ANY($${paramIndex})`);
          params.push(topModules);
          paramIndex++;
        }

        if (topTags.length > 0) {
          orConditions.push(`tags && $${paramIndex}::text[]`);
          params.push(topTags);
          paramIndex++;
        }

        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(' OR ')})`);
        }

        const result = await db.query<ContextEntry>(
          `SELECT * FROM context_entries
           WHERE ${conditions.join(' AND ')}
           ORDER BY updated_at DESC LIMIT 10`
        , params);

        for (const row of result.rows) {
          const entry = this.mapRowToEntry(row);

          // Calculate confidence based on preference match
          let confidence = 0.4;
          if (topTypes.includes(entry.type)) confidence += 0.15;
          if (entry.moduleId && topModules.includes(entry.moduleId)) confidence += 0.15;
          if (entry.tags.some(t => topTags.includes(t))) confidence += 0.1;

          contexts.push({
            contextId: entry.id,
            entry,
            confidence: Math.min(0.8, confidence),
            reason: 'user_preference',
            source: 'preference_engine',
          });
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to find contexts from preferences');
      }
    }

    // Check file type associations
    if (currentFileExtension) {
      const associatedContexts = preference.fileTypeAssociations.get(currentFileExtension) || [];
      if (associatedContexts.length > 0) {
        try {
          const result = await db.query<ContextEntry>(
            `SELECT * FROM context_entries
             WHERE id = ANY($1) AND status = 'active'`,
            [associatedContexts.slice(-5)]
          );

          for (const row of result.rows) {
            const entry = this.mapRowToEntry(row);
            if (!contexts.find(c => c.contextId === entry.id)) {
              contexts.push({
                contextId: entry.id,
                entry,
                confidence: 0.65,
                reason: 'user_preference',
                source: 'preference_engine',
              });
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to find contexts from file associations');
        }
      }
    }

    return contexts;
  }

  /**
   * Get user preference statistics
   */
  getUserPreferenceStats(userId: string, projectId: string): {
    topTypes: Array<{ type: string; weight: number }>;
    topModules: Array<{ moduleId: string; weight: number }>;
    topTags: Array<{ tag: string; weight: number }>;
    lastUpdated: number | null;
  } {
    const key = `${userId}:${projectId}`;
    const preference = this.userPreferences.get(key);

    if (!preference) {
      return {
        topTypes: [],
        topModules: [],
        topTags: [],
        lastUpdated: null,
      };
    }

    return {
      topTypes: Array.from(preference.preferredContextTypes.entries())
        .map(([type, weight]) => ({ type, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5),
      topModules: Array.from(preference.preferredModules.entries())
        .map(([moduleId, weight]) => ({ moduleId, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5),
      topTags: Array.from(preference.preferredTags.entries())
        .map(([tag, weight]) => ({ tag, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 10),
      lastUpdated: preference.lastUpdated,
    };
  }

  // ============================================
  // T-005.5: Override Support & Main Detection
  // ============================================

  /**
   * Set a manual override for context detection
   */
  setOverride(
    userId: string,
    projectId: string,
    contextIds: string[],
    durationMs?: number
  ): void {
    const key = `${userId}:${projectId}`;

    this.activeOverrides.set(key, {
      userId,
      projectId,
      contextIds,
      expiresAt: durationMs ? Date.now() + durationMs : null,
    });

    logger.info({ userId, projectId, contextIds, durationMs }, 'Override set');
  }

  /**
   * Clear manual override
   */
  clearOverride(userId: string, projectId: string): void {
    const key = `${userId}:${projectId}`;
    this.activeOverrides.delete(key);
    logger.info({ userId, projectId }, 'Override cleared');
  }

  /**
   * Get active override if any
   */
  getActiveOverride(userId: string, projectId: string): OverrideConfig | null {
    const key = `${userId}:${projectId}`;
    const override = this.activeOverrides.get(key);

    if (!override) return null;

    // Check if expired
    if (override.expiresAt && Date.now() > override.expiresAt) {
      this.activeOverrides.delete(key);
      return null;
    }

    return override;
  }

  /**
   * Main detection method - combines all sources
   */
  async detectContext(request: DetectionRequest): Promise<DetectionResponse> {
    const startTime = Date.now();
    const sourcesUsed: DetectionSource[] = [];
    let allContexts: DetectedContext[] = [];

    // Check for active override
    const override = this.getActiveOverride(request.userId, request.projectId);
    if (override) {
      const overrideContexts = await this.loadOverrideContexts(override);
      return {
        suggestedContexts: overrideContexts,
        primaryContext: overrideContexts[0] || null,
        alternativeContexts: overrideContexts.slice(1),
        metadata: {
          detectionTimeMs: Date.now() - startTime,
          sourcesUsed: ['manual_override'],
          overrideActive: true,
        },
      };
    }

    // T-005.1: File analysis
    if (request.currentFile) {
      const fileAnalysis = this.analyzeFile(request.currentFile);
      const fileContexts = await this.findContextsForFile(request.projectId, fileAnalysis);

      // Apply weight
      for (const ctx of fileContexts) {
        ctx.confidence *= this.config.filePatternWeight / 0.25; // Normalize
      }

      allContexts.push(...fileContexts);
      sourcesUsed.push('file_analyzer');
    }

    // T-005.2: Navigation history
    const navContexts = await this.findContextsFromNavigation(
      request.userId,
      request.projectId
    );

    for (const ctx of navContexts) {
      ctx.confidence *= this.config.navigationWeight / 0.1;
    }

    allContexts.push(...navContexts);
    if (navContexts.length > 0) sourcesUsed.push('navigation_tracker');

    // T-005.3: Git context
    if (request.gitBranch) {
      const gitContext = this.parseGitContext(
        request.gitBranch,
        request.gitModifiedFiles || [],
        []
      );
      const gitContexts = await this.findContextsFromGit(request.projectId, gitContext);

      for (const ctx of gitContexts) {
        ctx.confidence *= this.config.gitContextWeight / 0.2;
      }

      allContexts.push(...gitContexts);
      if (gitContexts.length > 0) sourcesUsed.push('git_integration');
    }

    // T-005.4: User preferences
    const currentExtension = request.currentFile
      ? this.analyzeFile(request.currentFile).extension
      : undefined;

    const prefContexts = await this.findContextsFromPreferences(
      request.userId,
      request.projectId,
      currentExtension
    );

    for (const ctx of prefContexts) {
      ctx.confidence *= this.config.userPreferenceWeight / 0.15;
    }

    allContexts.push(...prefContexts);
    if (prefContexts.length > 0) sourcesUsed.push('preference_engine');

    // Semantic search as fallback/supplement
    if (request.currentFile && allContexts.length < this.config.maxSuggestions) {
      const fileAnalysis = this.analyzeFile(request.currentFile);
      const searchQuery = [...fileAnalysis.patterns, ...fileAnalysis.moduleHints]
        .slice(0, 3)
        .join(' ');

      if (searchQuery.length > 0) {
        try {
          const searchResults = await this.searchService.search({
            query: searchQuery,
            projectId: request.projectId,
            limit: 5,
            semantic: true,
            minSimilarity: this.config.minConfidenceThreshold,
          });

          for (const result of searchResults.results) {
            if (!allContexts.find(c => c.contextId === result.entry.id)) {
              allContexts.push({
                contextId: result.entry.id,
                entry: result.entry,
                confidence: (result.similarity || 0.5) * this.config.semanticSearchWeight,
                reason: 'semantic_similarity',
                source: 'file_analyzer',
              });
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Semantic search failed during detection');
        }
      }
    }

    // Deduplicate and merge confidence scores
    const merged = this.mergeAndDeduplicateContexts(allContexts);

    // Filter by threshold and sort by confidence
    const filtered = merged
      .filter(ctx => ctx.confidence >= this.config.minConfidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestions);

    return {
      suggestedContexts: filtered,
      primaryContext: filtered[0] || null,
      alternativeContexts: filtered.slice(1),
      metadata: {
        detectionTimeMs: Date.now() - startTime,
        sourcesUsed,
        overrideActive: false,
      },
    };
  }

  private async loadOverrideContexts(override: OverrideConfig): Promise<DetectedContext[]> {
    const db = getDatabase();
    const contexts: DetectedContext[] = [];

    try {
      const result = await db.query<ContextEntry>(
        'SELECT * FROM context_entries WHERE id = ANY($1)',
        [override.contextIds]
      );

      for (const row of result.rows) {
        const entry = this.mapRowToEntry(row);
        contexts.push({
          contextId: entry.id,
          entry,
          confidence: 1.0,
          reason: 'explicit_override',
          source: 'manual_override',
        });
      }
    } catch (err) {
      logger.error({ err, override }, 'Failed to load override contexts');
    }

    return contexts;
  }

  private mergeAndDeduplicateContexts(contexts: DetectedContext[]): DetectedContext[] {
    const merged: Map<string, DetectedContext> = new Map();

    for (const ctx of contexts) {
      const existing = merged.get(ctx.contextId);

      if (existing) {
        // Merge confidence scores (weighted average favoring higher)
        existing.confidence = Math.min(1, (existing.confidence + ctx.confidence) * 0.6);
      } else {
        merged.set(ctx.contextId, { ...ctx });
      }
    }

    return Array.from(merged.values());
  }

  // ============================================
  // Utility Methods
  // ============================================

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

  /**
   * Get service statistics
   */
  getStats(): {
    isEnabled: boolean;
    config: AutoDetectionConfig;
    activeSessionsCount: number;
    activeOverridesCount: number;
    userPreferencesCount: number;
    navigationHistorySize: number;
  } {
    return {
      isEnabled: this.config.enabled,
      config: this.config,
      activeSessionsCount: this.sessionContexts.size,
      activeOverridesCount: this.activeOverrides.size,
      userPreferencesCount: this.userPreferences.size,
      navigationHistorySize: Array.from(this.navigationHistory.values())
        .reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  /**
   * Clear all session data for a user
   */
  clearUserSession(userId: string): void {
    // Clear navigation history
    for (const [key] of this.navigationHistory) {
      if (key.startsWith(`${userId}:`)) {
        this.navigationHistory.delete(key);
      }
    }

    // Clear overrides
    for (const [key] of this.activeOverrides) {
      if (key.startsWith(`${userId}:`)) {
        this.activeOverrides.delete(key);
      }
    }

    // Clear session contexts
    this.sessionContexts.delete(userId);

    logger.info({ userId }, 'User session cleared');
  }
}

// ============================================
// Singleton Instance
// ============================================

let serviceInstance: AutoContextDetectionService | null = null;

export function getAutoContextDetectionService(
  config?: Partial<AutoDetectionConfig>
): AutoContextDetectionService {
  if (!serviceInstance) {
    serviceInstance = new AutoContextDetectionService(config);
  }
  return serviceInstance;
}

export function shutdownAutoContextDetection(): void {
  if (serviceInstance) {
    serviceInstance = null;
    logger.info('AutoContextDetectionService shutdown');
  }
}
