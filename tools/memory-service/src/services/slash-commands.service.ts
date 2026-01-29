/**
 * US-008: Slash Commands Service
 *
 * Implements custom slash commands for quick access to Memory Bank information:
 * - AC-008.1: /context - Shows current file/module context
 * - AC-008.2: /adr - Lists and searches Architecture Decision Records
 * - AC-008.3: /pattern - Searches documented design patterns
 * - AC-008.4: /team - Shows team conventions
 * - AC-008.5: Auto-completion of available commands
 * - AC-008.6: Inline help with /help
 */

import { getDatabase } from '../database/client.js';
import { getContextMultiCache, MultiLevelCache } from '../cache/multi-level-cache.js';
import { getSemanticSearchService, SemanticSearchService } from './semantic-search.service.js';
import { createChildLogger } from '../utils/logger.js';
import { ContextEntry, SearchResult } from '../models/index.js';

const logger = createChildLogger('slash-commands');

// ============================================
// Types and Interfaces
// ============================================

export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  examples: string[];
  category: CommandCategory;
}

export type CommandCategory = 'context' | 'documentation' | 'team' | 'help';

export interface ParsedCommand {
  command: string;
  args: string[];
  rawArgs: string;
  flags: Map<string, string | boolean>;
  isValid: boolean;
  error?: string;
}

export interface CommandExecutionContext {
  userId: string;
  projectId: string;
  currentFile: string | undefined;
  moduleId: string | undefined;
  workspaceRoot?: string | undefined;
}

export interface CommandResult {
  success: boolean;
  command: string;
  data: CommandResultData;
  executionTimeMs: number;
  cached: boolean;
}

export type CommandResultData =
  | ContextCommandResult
  | AdrCommandResult
  | PatternCommandResult
  | TeamCommandResult
  | HelpCommandResult
  | ErrorCommandResult;

export interface ContextCommandResult {
  type: 'context';
  currentFile: string | undefined;
  module: {
    id: string;
    name: string;
    description: string | null;
    path: string | null;
  } | undefined;
  relatedContexts: Array<{
    id: string;
    title: string;
    type: string;
    relevance: number;
  }>;
  activeContext: {
    id: string;
    title: string;
    content: string;
  } | undefined;
}

export interface AdrCommandResult {
  type: 'adr';
  adrs: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    decisionDate: Date | null;
    summary: string;
    tags: string[];
  }>;
  total: number;
  query: string | undefined;
}

export interface PatternCommandResult {
  type: 'pattern';
  patterns: Array<{
    id: string;
    title: string;
    description: string;
    category: string | undefined;
    tags: string[];
    usageCount: number | undefined;
  }>;
  total: number;
  query: string | undefined;
}

export interface TeamCommandResult {
  type: 'team';
  conventions: Array<{
    id: string;
    title: string;
    category: string;
    content: string;
    tags: string[];
  }>;
  teamInfo: {
    name: string;
    roles: string[];
    contacts: Array<{
      name: string;
      role: string;
      expertise: string[];
    }>;
  } | undefined;
}

export interface HelpCommandResult {
  type: 'help';
  availableCommands: SlashCommand[];
  requestedCommand: SlashCommand | undefined;
}

export interface ErrorCommandResult {
  type: 'error';
  error: string;
  suggestion: string | undefined;
}

export interface CommandCompletionSuggestion {
  command: string;
  description: string;
  insertText: string;
  category: CommandCategory;
}

// ============================================
// Available Commands Registry
// ============================================

const AVAILABLE_COMMANDS: SlashCommand[] = [
  {
    name: 'context',
    aliases: ['ctx', 'c'],
    description: 'Shows context information for the current file or module',
    usage: '/context [file-path] [--module <module-name>]',
    examples: [
      '/context',
      '/context src/services/auth.ts',
      '/context --module user-management',
    ],
    category: 'context',
  },
  {
    name: 'adr',
    aliases: ['decision', 'decisions'],
    description: 'Lists and searches Architecture Decision Records',
    usage: '/adr [search-query] [--status <status>] [--limit <n>]',
    examples: [
      '/adr',
      '/adr database',
      '/adr --status active',
      '/adr authentication --limit 5',
    ],
    category: 'documentation',
  },
  {
    name: 'pattern',
    aliases: ['patterns', 'pat'],
    description: 'Searches documented design patterns in the Memory Bank',
    usage: '/pattern [search-query] [--category <category>]',
    examples: [
      '/pattern',
      '/pattern repository',
      '/pattern --category creational',
      '/pattern singleton --category design',
    ],
    category: 'documentation',
  },
  {
    name: 'team',
    aliases: ['conventions', 'rules'],
    description: 'Shows team conventions, coding standards, and contacts',
    usage: '/team [section] [--role <role>]',
    examples: [
      '/team',
      '/team conventions',
      '/team contacts',
      '/team --role backend',
    ],
    category: 'team',
  },
  {
    name: 'help',
    aliases: ['?', 'h'],
    description: 'Shows help information for available slash commands',
    usage: '/help [command-name]',
    examples: [
      '/help',
      '/help context',
      '/help adr',
    ],
    category: 'help',
  },
];

// ============================================
// Slash Commands Service
// ============================================

export class SlashCommandsService {
  private cache: MultiLevelCache | null = null;
  private semanticSearch: SemanticSearchService | null = null;
  private readonly commands: Map<string, SlashCommand>;
  private readonly aliasMap: Map<string, string>;

  constructor() {
    // Build command lookup maps
    this.commands = new Map();
    this.aliasMap = new Map();

    for (const cmd of AVAILABLE_COMMANDS) {
      this.commands.set(cmd.name, cmd);
      for (const alias of cmd.aliases) {
        this.aliasMap.set(alias, cmd.name);
      }
    }

    logger.info('SlashCommandsService initialized', {
      commandCount: this.commands.size,
      aliasCount: this.aliasMap.size,
    });
  }

  /**
   * Initialize cache and search services
   */
  async initialize(): Promise<void> {
    try {
      this.cache = await getContextMultiCache();
      this.semanticSearch = getSemanticSearchService();
      logger.info('SlashCommandsService dependencies initialized');
    } catch (error) {
      logger.warn('Failed to initialize some dependencies', { error });
    }
  }

  // ============================================
  // Command Parser (T-008.1)
  // ============================================

  /**
   * Parse a raw slash command string into structured components
   */
  parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();

    // Check if input starts with /
    if (!trimmed.startsWith('/')) {
      return {
        command: '',
        args: [],
        rawArgs: '',
        flags: new Map(),
        isValid: false,
        error: 'Command must start with /',
      };
    }

    // Remove the leading /
    const withoutSlash = trimmed.slice(1);
    const parts = this.tokenize(withoutSlash);

    if (parts.length === 0) {
      return {
        command: '',
        args: [],
        rawArgs: '',
        flags: new Map(),
        isValid: false,
        error: 'No command specified',
      };
    }

    const firstPart = parts[0];
    if (!firstPart) {
      return {
        command: '',
        args: [],
        rawArgs: '',
        flags: new Map(),
        isValid: false,
        error: 'No command specified',
      };
    }

    const commandName = firstPart.toLowerCase();
    const resolvedCommand = this.resolveCommand(commandName);

    if (!resolvedCommand) {
      const suggestion = this.getSuggestion(commandName);
      return {
        command: commandName,
        args: [],
        rawArgs: '',
        flags: new Map(),
        isValid: false,
        error: `Unknown command: /${commandName}${suggestion ? `. Did you mean /${suggestion}?` : ''}`,
      };
    }

    // Parse args and flags
    const args: string[] = [];
    const flags = new Map<string, string | boolean>();
    let i = 1;

    while (i < parts.length) {
      const part = parts[i];
      if (!part) {
        i++;
        continue;
      }

      if (part.startsWith('--')) {
        // Long flag
        const flagName = part.slice(2);
        const nextPart = parts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          flags.set(flagName, nextPart);
          i += 2;
        } else {
          flags.set(flagName, true);
          i++;
        }
      } else if (part.startsWith('-') && part.length === 2) {
        // Short flag
        const flagName = part.slice(1);
        const nextPart = parts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          flags.set(flagName, nextPart);
          i += 2;
        } else {
          flags.set(flagName, true);
          i++;
        }
      } else {
        args.push(part);
        i++;
      }
    }

    return {
      command: resolvedCommand,
      args,
      rawArgs: args.join(' '),
      flags,
      isValid: true,
    };
  }

  /**
   * Tokenize input string respecting quoted strings
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Resolve command name or alias to actual command name
   */
  private resolveCommand(name: string): string | null {
    if (this.commands.has(name)) {
      return name;
    }
    return this.aliasMap.get(name) || null;
  }

  /**
   * Get suggestion for misspelled command
   */
  private getSuggestion(input: string): string | null {
    const allNames = [
      ...this.commands.keys(),
      ...this.aliasMap.keys(),
    ];

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const name of allNames) {
      const score = this.similarity(input, name);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = this.aliasMap.get(name) || name;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity (Jaro-Winkler-like)
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    const matchWindow = Math.floor(longer.length / 2) - 1;
    const matchesA: boolean[] = new Array(longer.length).fill(false);
    const matchesB: boolean[] = new Array(shorter.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < shorter.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, longer.length);

      for (let j = start; j < end; j++) {
        if (matchesA[j] || shorter[i] !== longer[j]) continue;
        matchesA[j] = true;
        matchesB[i] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (!matchesB[i]) continue;
      while (!matchesA[k]) k++;
      if (shorter[i] !== longer[k]) transpositions++;
      k++;
    }

    return (
      (matches / shorter.length +
        matches / longer.length +
        (matches - transpositions / 2) / matches) /
      3
    );
  }

  // ============================================
  // Command Execution
  // ============================================

  /**
   * Execute a slash command
   */
  async executeCommand(
    input: string,
    context: CommandExecutionContext
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const parsed = this.parseCommand(input);

    if (!parsed.isValid) {
      return {
        success: false,
        command: parsed.command || 'unknown',
        data: {
          type: 'error',
          error: parsed.error || 'Invalid command',
          suggestion: parsed.error?.includes('Did you mean') ? undefined : 'Use /help for available commands',
        },
        executionTimeMs: Date.now() - startTime,
        cached: false,
      };
    }

    try {
      let result: CommandResultData;
      let cached = false;

      switch (parsed.command) {
        case 'context':
          result = await this.executeContextCommand(parsed, context);
          break;
        case 'adr':
          result = await this.executeAdrCommand(parsed, context);
          break;
        case 'pattern':
          result = await this.executePatternCommand(parsed, context);
          break;
        case 'team':
          result = await this.executeTeamCommand(parsed, context);
          break;
        case 'help':
          result = this.executeHelpCommand(parsed);
          cached = true; // Help is always cached
          break;
        default:
          result = {
            type: 'error',
            error: `Command handler not implemented: ${parsed.command}`,
            suggestion: undefined,
          };
      }

      return {
        success: result.type !== 'error',
        command: parsed.command,
        data: result,
        executionTimeMs: Date.now() - startTime,
        cached,
      };
    } catch (error) {
      logger.error('Command execution failed', {
        command: parsed.command,
        error,
      });

      return {
        success: false,
        command: parsed.command,
        data: {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: undefined,
        },
        executionTimeMs: Date.now() - startTime,
        cached: false,
      };
    }
  }

  // ============================================
  // /context Handler (T-008.2)
  // ============================================

  /**
   * Execute /context command - shows context for current file/module
   */
  private async executeContextCommand(
    parsed: ParsedCommand,
    context: CommandExecutionContext
  ): Promise<ContextCommandResult | ErrorCommandResult> {
    const db = getDatabase();
    const filePath = parsed.args[0] || context.currentFile;
    const moduleFilter = parsed.flags.get('module') as string | undefined;

    try {
      let moduleInfo: ContextCommandResult['module'] | undefined;
      let moduleId: string | undefined = context.moduleId;

      // Try to find module by name or path
      if (moduleFilter || filePath) {
        const moduleQuery = await db.query(
          `SELECT id, name, description, path
           FROM modules
           WHERE project_id = $1
           AND (
             LOWER(name) LIKE LOWER($2)
             OR path LIKE $3
           )
           LIMIT 1`,
          [
            context.projectId,
            moduleFilter ? `%${moduleFilter}%` : '%',
            filePath ? `%${filePath}%` : '%',
          ]
        );

        if (moduleQuery.rows.length > 0) {
          const mod = moduleQuery.rows[0] as Record<string, unknown>;
          moduleInfo = {
            id: mod.id as string,
            name: mod.name as string,
            description: mod.description as string | null,
            path: mod.path as string | null,
          };
          moduleId = mod.id as string;
        }
      }

      // Get related contexts
      const contextQuery = await db.query(
        `SELECT ce.id, ce.title, ce.type, ce.tags
         FROM context_entries ce
         WHERE ce.project_id = $1
         AND ce.status = 'active'
         AND (
           ce.module_id = $2
           OR ce.module_id IS NULL
         )
         ORDER BY ce.updated_at DESC
         LIMIT 10`,
        [context.projectId, moduleId || null]
      );

      const relatedContexts = contextQuery.rows.map((row: Record<string, unknown>, idx: number) => ({
        id: row.id as string,
        title: row.title as string,
        type: row.type as string,
        relevance: 1 - idx * 0.1, // Simple relevance score
      }));

      // Get active context (most recently updated context entry)
      let activeContext: ContextCommandResult['activeContext'] = undefined;
      const firstRelated = relatedContexts[0];
      if (firstRelated) {
        const activeQuery = await db.query(
          `SELECT id, title, content
           FROM context_entries
           WHERE id = $1`,
          [firstRelated.id]
        );

        if (activeQuery.rows.length > 0) {
          const active = activeQuery.rows[0] as Record<string, unknown>;
          const content = active.content as string;
          activeContext = {
            id: active.id as string,
            title: active.title as string,
            content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          };
        }
      }

      return {
        type: 'context',
        currentFile: filePath,
        module: moduleInfo,
        relatedContexts,
        activeContext,
      };
    } catch (error) {
      logger.error('Context command failed', { error, context });
      return {
        type: 'error',
        error: 'Failed to retrieve context information',
        suggestion: undefined,
      };
    }
  }

  // ============================================
  // /adr Handler (T-008.3)
  // ============================================

  /**
   * Execute /adr command - lists and searches ADRs
   */
  private async executeAdrCommand(
    parsed: ParsedCommand,
    context: CommandExecutionContext
  ): Promise<AdrCommandResult | ErrorCommandResult> {
    const db = getDatabase();
    const searchQuery = parsed.rawArgs;
    const statusFilter = parsed.flags.get('status') as string | undefined;
    const limit = parseInt(parsed.flags.get('limit') as string || '10', 10);

    try {
      let query: string;
      const params: unknown[] = [context.projectId];

      if (searchQuery && this.semanticSearch) {
        // Use semantic search for better results
        const searchResults = await this.semanticSearch.search({
          query: searchQuery,
          projectId: context.projectId,
          types: ['adr'],
          limit,
          offset: 0,
          semantic: true,
          minSimilarity: 0.5,
          includeHighlights: false,
        });

        const adrIds = searchResults.results.map((r: SearchResult) => r.entry.id);

        if (adrIds.length === 0) {
          // Fallback to text search
          query = `
            SELECT ce.id, a.adr_number, ce.title, ce.status, a.decision_date,
                   ce.content, ce.tags
            FROM context_entries ce
            JOIN adrs a ON ce.id = a.context_entry_id
            WHERE ce.project_id = $1
            AND ce.type = 'adr'
            AND (
              LOWER(ce.title) LIKE LOWER($2)
              OR LOWER(ce.content) LIKE LOWER($2)
            )
            ${statusFilter ? 'AND ce.status = $3' : ''}
            ORDER BY a.adr_number DESC
            LIMIT ${limit}`;
          params.push(`%${searchQuery}%`);
          if (statusFilter) params.push(statusFilter);
        } else {
          query = `
            SELECT ce.id, a.adr_number, ce.title, ce.status, a.decision_date,
                   ce.content, ce.tags
            FROM context_entries ce
            JOIN adrs a ON ce.id = a.context_entry_id
            WHERE ce.id = ANY($2)
            ${statusFilter ? 'AND ce.status = $3' : ''}
            ORDER BY array_position($2, ce.id)`;
          params.push(adrIds);
          if (statusFilter) params.push(statusFilter);
        }
      } else {
        // List all ADRs
        query = `
          SELECT ce.id, a.adr_number, ce.title, ce.status, a.decision_date,
                 ce.content, ce.tags
          FROM context_entries ce
          JOIN adrs a ON ce.id = a.context_entry_id
          WHERE ce.project_id = $1
          AND ce.type = 'adr'
          ${statusFilter ? 'AND ce.status = $2' : ''}
          ORDER BY a.adr_number DESC
          LIMIT ${limit}`;
        if (statusFilter) params.push(statusFilter);
      }

      const result = await db.query(query, params);

      const adrs = result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        number: row.adr_number as number,
        title: row.title as string,
        status: row.status as string,
        decisionDate: row.decision_date as Date | null,
        summary: this.extractSummary(row.content as string),
        tags: (row.tags as string[]) || [],
      }));

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total
         FROM context_entries ce
         JOIN adrs a ON ce.id = a.context_entry_id
         WHERE ce.project_id = $1
         AND ce.type = 'adr'
         ${statusFilter ? 'AND ce.status = $2' : ''}`,
        statusFilter ? [context.projectId, statusFilter] : [context.projectId]
      );

      const countRow = countResult.rows[0] as Record<string, unknown> | undefined;
      return {
        type: 'adr',
        adrs,
        total: parseInt(String(countRow?.total ?? 0), 10),
        query: searchQuery || undefined,
      };
    } catch (error) {
      logger.error('ADR command failed', { error, context });
      return {
        type: 'error',
        error: 'Failed to retrieve ADRs',
        suggestion: undefined,
      };
    }
  }

  // ============================================
  // /pattern Handler (T-008.4)
  // ============================================

  /**
   * Execute /pattern command - searches design patterns
   */
  private async executePatternCommand(
    parsed: ParsedCommand,
    context: CommandExecutionContext
  ): Promise<PatternCommandResult | ErrorCommandResult> {
    const db = getDatabase();
    const searchQuery = parsed.rawArgs;
    const categoryFilter = parsed.flags.get('category') as string | undefined;
    const limit = parseInt(parsed.flags.get('limit') as string || '10', 10);

    try {
      let query: string;
      const params: unknown[] = [context.projectId];

      if (searchQuery && this.semanticSearch) {
        // Use semantic search
        const searchResults = await this.semanticSearch.search({
          query: searchQuery,
          projectId: context.projectId,
          types: ['pattern'],
          limit,
          offset: 0,
          semantic: true,
          minSimilarity: 0.5,
          includeHighlights: false,
        });

        const patternIds = searchResults.results.map((r: SearchResult) => r.entry.id);

        if (patternIds.length > 0) {
          query = `
            SELECT ce.id, ce.title, ce.content, ce.tags, ce.metadata
            FROM context_entries ce
            WHERE ce.id = ANY($2)
            ORDER BY array_position($2, ce.id)`;
          params.push(patternIds);
        } else {
          // Fallback to text search
          query = `
            SELECT ce.id, ce.title, ce.content, ce.tags, ce.metadata
            FROM context_entries ce
            WHERE ce.project_id = $1
            AND ce.type = 'pattern'
            AND ce.status = 'active'
            AND (
              LOWER(ce.title) LIKE LOWER($2)
              OR LOWER(ce.content) LIKE LOWER($2)
              ${categoryFilter ? "OR ce.metadata->>'category' = $3" : ''}
            )
            ORDER BY ce.updated_at DESC
            LIMIT ${limit}`;
          params.push(`%${searchQuery}%`);
          if (categoryFilter) params.push(categoryFilter);
        }
      } else {
        // List all patterns
        query = `
          SELECT ce.id, ce.title, ce.content, ce.tags, ce.metadata
          FROM context_entries ce
          WHERE ce.project_id = $1
          AND ce.type = 'pattern'
          AND ce.status = 'active'
          ${categoryFilter ? "AND ce.metadata->>'category' = $2" : ''}
          ORDER BY ce.title ASC
          LIMIT ${limit}`;
        if (categoryFilter) params.push(categoryFilter);
      }

      const result = await db.query(query, params);

      const patterns = result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        description: this.extractSummary(row.content as string),
        category: (row.metadata as Record<string, unknown> | undefined)?.category as string | undefined,
        tags: (row.tags as string[]) || [],
        usageCount: (row.metadata as Record<string, unknown> | undefined)?.usageCount as number | undefined,
      }));

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total
         FROM context_entries
         WHERE project_id = $1
         AND type = 'pattern'
         AND status = 'active'
         ${categoryFilter ? "AND metadata->>'category' = $2" : ''}`,
        categoryFilter ? [context.projectId, categoryFilter] : [context.projectId]
      );

      const countRow = countResult.rows[0] as Record<string, unknown> | undefined;
      return {
        type: 'pattern',
        patterns,
        total: parseInt(String(countRow?.total ?? 0), 10),
        query: searchQuery || undefined,
      };
    } catch (error) {
      logger.error('Pattern command failed', { error, context });
      return {
        type: 'error',
        error: 'Failed to retrieve patterns',
        suggestion: undefined,
      };
    }
  }

  // ============================================
  // /team Handler (T-008.5)
  // ============================================

  /**
   * Execute /team command - shows team conventions and contacts
   */
  private async executeTeamCommand(
    parsed: ParsedCommand,
    context: CommandExecutionContext
  ): Promise<TeamCommandResult | ErrorCommandResult> {
    const db = getDatabase();
    const section = parsed.args[0];
    const roleFilter = parsed.flags.get('role') as string | undefined;

    try {
      // Get team-related context entries
      const query = `
        SELECT ce.id, ce.title, ce.content, ce.tags, ce.metadata
        FROM context_entries ce
        WHERE ce.project_id = $1
        AND ce.type = 'team'
        AND ce.status = 'active'
        ${section ? "AND (LOWER(ce.title) LIKE LOWER($2) OR ce.metadata->>'section' = $2)" : ''}
        ORDER BY ce.title ASC
        LIMIT 20`;

      const params: unknown[] = [context.projectId];
      if (section) params.push(`%${section}%`);

      const result = await db.query(query, params);

      // Extract conventions from team entries
      const conventions = result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        category: ((row.metadata as Record<string, unknown> | undefined)?.section as string) || 'general',
        content: ((row.content as string) || '').substring(0, 300) + (((row.content as string) || '').length > 300 ? '...' : ''),
        tags: (row.tags as string[]) || [],
      }));

      // Try to get team info from project settings or a specific team context
      let teamInfo: TeamCommandResult['teamInfo'] | undefined;

      const teamInfoQuery = await db.query(
        `SELECT ce.content, ce.metadata
         FROM context_entries ce
         WHERE ce.project_id = $1
         AND ce.type = 'team'
         AND (
           LOWER(ce.title) LIKE '%team info%'
           OR LOWER(ce.title) LIKE '%team structure%'
           OR ce.metadata->>'isTeamInfo' = 'true'
         )
         AND ce.status = 'active'
         LIMIT 1`,
        [context.projectId]
      );

      if (teamInfoQuery.rows.length > 0) {
        const teamData = teamInfoQuery.rows[0] as Record<string, unknown>;
        const metadata = (teamData.metadata as Record<string, unknown>) || {};

        // Parse team info from content or metadata
        teamInfo = {
          name: (metadata.teamName as string) || 'Development Team',
          roles: (metadata.roles as string[]) || this.extractRoles(teamData.content as string),
          contacts: ((metadata.contacts as Array<{name: string; role: string; expertise: string[]}>) || [])
            .filter((c) => !roleFilter || c.role.toLowerCase().includes(roleFilter.toLowerCase())),
        };
      }

      return {
        type: 'team',
        conventions,
        teamInfo,
      };
    } catch (error) {
      logger.error('Team command failed', { error, context });
      return {
        type: 'error',
        error: 'Failed to retrieve team information',
        suggestion: undefined,
      };
    }
  }

  /**
   * Extract roles from team content
   */
  private extractRoles(content: string): string[] {
    const rolePatterns = [
      /##\s*roles?:?\s*\n([\s\S]*?)(?=\n##|$)/i,
      /roles?:\s*\n([\s\S]*?)(?=\n\w+:|$)/i,
    ];

    for (const pattern of rolePatterns) {
      const match = content.match(pattern);
      const capturedText = match?.[1];
      if (capturedText) {
        return capturedText
          .split('\n')
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length > 0);
      }
    }

    return [];
  }

  // ============================================
  // /help Handler (AC-008.6)
  // ============================================

  /**
   * Execute /help command - shows available commands
   */
  private executeHelpCommand(parsed: ParsedCommand): HelpCommandResult {
    const requestedCommand = parsed.args[0];

    if (requestedCommand) {
      const cmd = this.commands.get(requestedCommand) ||
                  this.commands.get(this.aliasMap.get(requestedCommand) || '');

      return {
        type: 'help',
        availableCommands: AVAILABLE_COMMANDS,
        requestedCommand: cmd,
      };
    }

    return {
      type: 'help',
      availableCommands: AVAILABLE_COMMANDS,
      requestedCommand: undefined,
    };
  }

  // ============================================
  // Auto-completion (T-008.6)
  // ============================================

  /**
   * Get command completion suggestions
   */
  getCompletionSuggestions(partial: string): CommandCompletionSuggestion[] {
    const trimmed = partial.trim();

    // If just "/" or empty, return all commands
    if (trimmed === '/' || trimmed === '') {
      return AVAILABLE_COMMANDS.map((cmd) => ({
        command: cmd.name,
        description: cmd.description,
        insertText: `/${cmd.name} `,
        category: cmd.category,
      }));
    }

    // If starts with /, filter commands
    if (trimmed.startsWith('/')) {
      const search = trimmed.slice(1).toLowerCase();
      const suggestions: CommandCompletionSuggestion[] = [];

      for (const cmd of AVAILABLE_COMMANDS) {
        if (cmd.name.startsWith(search)) {
          suggestions.push({
            command: cmd.name,
            description: cmd.description,
            insertText: `/${cmd.name} `,
            category: cmd.category,
          });
        }

        // Also check aliases
        for (const alias of cmd.aliases) {
          if (alias.startsWith(search) && alias !== cmd.name) {
            suggestions.push({
              command: alias,
              description: `${cmd.description} (alias for /${cmd.name})`,
              insertText: `/${alias} `,
              category: cmd.category,
            });
          }
        }
      }

      // Sort by relevance
      suggestions.sort((a, b) => {
        const aExact = a.command === search ? 0 : 1;
        const bExact = b.command === search ? 0 : 1;
        return aExact - bExact || a.command.localeCompare(b.command);
      });

      return suggestions;
    }

    return [];
  }

  /**
   * Get argument completion suggestions for a specific command
   */
  async getArgumentSuggestions(
    command: string,
    context: CommandExecutionContext
  ): Promise<string[]> {
    const db = getDatabase();
    const suggestions: string[] = [];

    try {
      switch (command) {
        case 'adr':
          // Suggest status values
          suggestions.push('--status active', '--status deprecated', '--status draft');
          // Suggest recent ADR titles
          const adrResult = await db.query(
            `SELECT DISTINCT LOWER(SUBSTRING(title, 1, 30)) as title
             FROM context_entries
             WHERE project_id = $1 AND type = 'adr'
             LIMIT 5`,
            [context.projectId]
          );
          suggestions.push(...adrResult.rows.map((r: Record<string, unknown>) => r.title as string));
          break;

        case 'pattern':
          // Suggest categories
          const categoryResult = await db.query(
            `SELECT DISTINCT metadata->>'category' as category
             FROM context_entries
             WHERE project_id = $1
             AND type = 'pattern'
             AND metadata->>'category' IS NOT NULL`,
            [context.projectId]
          );
          for (const row of categoryResult.rows) {
            if (row.category) {
              suggestions.push(`--category ${row.category}`);
            }
          }
          break;

        case 'team':
          suggestions.push('conventions', 'contacts', 'roles', '--role backend', '--role frontend');
          break;

        case 'context':
          // Suggest module names
          const moduleResult = await db.query(
            `SELECT name FROM modules WHERE project_id = $1 LIMIT 10`,
            [context.projectId]
          );
          for (const row of moduleResult.rows) {
            suggestions.push(`--module ${row.name}`);
          }
          break;
      }
    } catch (error) {
      logger.warn('Failed to get argument suggestions', { error, command });
    }

    return suggestions;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Extract summary from content (first paragraph or first N chars)
   */
  private extractSummary(content: string, maxLength = 200): string {
    // Try to get first paragraph
    const paragraphs = content.split(/\n\n+/);
    let summary = paragraphs[0] || content;

    // Remove markdown headers
    summary = summary.replace(/^#+\s+/gm, '');

    // Truncate if needed
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength).trim() + '...';
    }

    return summary.trim();
  }

  /**
   * Get all available commands
   */
  getAvailableCommands(): SlashCommand[] {
    return [...AVAILABLE_COMMANDS];
  }

  /**
   * Get service statistics
   */
  getStats(): {
    commandCount: number;
    aliasCount: number;
    categories: CommandCategory[];
  } {
    const categories = [...new Set(AVAILABLE_COMMANDS.map((c) => c.category))];
    return {
      commandCount: this.commands.size,
      aliasCount: this.aliasMap.size,
      categories,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let slashCommandsInstance: SlashCommandsService | null = null;

export function getSlashCommandsService(): SlashCommandsService {
  if (!slashCommandsInstance) {
    slashCommandsInstance = new SlashCommandsService();
  }
  return slashCommandsInstance;
}

export async function initializeSlashCommandsService(): Promise<SlashCommandsService> {
  const service = getSlashCommandsService();
  await service.initialize();
  return service;
}
