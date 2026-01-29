/**
 * US-010: Contextual Hover Provider
 *
 * Provides Memory Bank context information when hovering over code symbols.
 *
 * Implements:
 * - AC-010.1: Hover over functions shows Memory Bank documentation
 * - AC-010.2: Hover over imports shows module information
 * - AC-010.3: Detects patterns and shows documentation
 * - AC-010.4: Configurable (activate/deactivate)
 * - AC-010.5: Asynchronous loading for non-blocking UI
 *
 * Technical Tasks:
 * - T-010.1: Implement HoverProvider
 * - T-010.2: Create code-to-context matching logic
 * - T-010.3: Design hover card formatting (Markdown)
 * - T-010.4: Implement hover result caching
 */

import * as vscode from 'vscode';
import { MemoryBankService } from '../services/MemoryBankService';
import {
  CodeContextMatcher,
  ContextMatch,
  ContextMatchType,
} from '../services/CodeContextMatcher';
import { HoverCache } from '../services/HoverCache';

// ============================================
// Types
// ============================================

interface CachedHoverResult {
  hover: vscode.Hover | null;
  timestamp: number;
}

// ============================================
// Contextual Hover Provider
// ============================================

export class ContextualHoverProvider implements vscode.HoverProvider {
  private memoryBankService: MemoryBankService;
  private contextMatcher: CodeContextMatcher;
  private hoverCache: HoverCache<CachedHoverResult>;
  private isEnabled: boolean = true;

  constructor(memoryBankService: MemoryBankService) {
    this.memoryBankService = memoryBankService;
    this.contextMatcher = new CodeContextMatcher(memoryBankService);
    this.hoverCache = new HoverCache<CachedHoverResult>({
      maxSize: 200,
      ttlMs: 3 * 60 * 1000, // 3 minutes
    });

    // Load initial configuration
    this.loadConfiguration();
  }

  /**
   * Provide hover information for code at the given position
   * AC-010.5: Asynchronous loading for non-blocking UI
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null | undefined> {
    // AC-010.4: Check if feature is enabled
    if (!this.isEnabled) {
      return undefined;
    }

    // Check if Memory Bank exists
    const hasMemoryBank = await this.memoryBankService.hasMemoryBank();
    if (!hasMemoryBank) {
      return undefined;
    }

    // Extract the symbol at the current position
    const symbol = await this.contextMatcher.extractSymbol(document, position);
    if (!symbol) {
      return undefined;
    }

    // Check cancellation
    if (token.isCancellationRequested) {
      return undefined;
    }

    // Check cache
    const cacheKey = HoverCache.generateKey(
      document.uri.fsPath,
      position.line,
      symbol.name
    );

    const cached = this.hoverCache.get(cacheKey);
    if (cached) {
      return cached.hover;
    }

    // Find matches asynchronously
    const matches = await this.contextMatcher.findMatches(symbol, document);

    // Check cancellation again
    if (token.isCancellationRequested) {
      return undefined;
    }

    if (matches.length === 0) {
      // Cache negative result
      this.hoverCache.set(cacheKey, { hover: null, timestamp: Date.now() });
      return undefined;
    }

    // Create hover content
    const hover = this.createHover(matches, symbol.name);

    // Cache the result
    this.hoverCache.set(cacheKey, { hover, timestamp: Date.now() });

    return hover;
  }

  /**
   * Create a Hover object from context matches
   * T-010.3: Design hover card formatting (Markdown)
   */
  private createHover(matches: ContextMatch[], symbolName: string): vscode.Hover {
    const contents: vscode.MarkdownString[] = [];

    // Add header
    const header = new vscode.MarkdownString();
    header.isTrusted = true;
    header.supportHtml = true;
    header.appendMarkdown(`### $(database) Memory Bank Context\n\n`);
    header.appendMarkdown(`**Symbol:** \`${symbolName}\`\n\n`);
    header.appendMarkdown('---\n\n');
    contents.push(header);

    // Add matches (limit to top 3 for readability)
    const displayMatches = matches.slice(0, 3);

    for (const match of displayMatches) {
      const matchContent = this.formatMatch(match);
      contents.push(matchContent);
    }

    // Add footer if there are more matches
    if (matches.length > 3) {
      const footer = new vscode.MarkdownString();
      footer.isTrusted = true;
      footer.appendMarkdown(`\n---\n`);
      footer.appendMarkdown(`*+${matches.length - 3} more results. Open Memory Bank for full context.*\n`);
      contents.push(footer);
    }

    // Add quick actions
    const actions = this.createQuickActions(matches[0]);
    if (actions) {
      contents.push(actions);
    }

    return new vscode.Hover(contents);
  }

  /**
   * Format a single context match as Markdown
   */
  private formatMatch(match: ContextMatch): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    // Icon based on type
    const icon = this.getMatchIcon(match.type);

    // Title with type badge
    md.appendMarkdown(`${icon} **${match.title}**\n\n`);

    // Type badge
    md.appendMarkdown(`$(tag) \`${this.getTypeBadge(match.type)}\`  `);
    md.appendMarkdown(`$(star) Relevance: ${Math.round(match.relevance * 100)}%\n\n`);

    // Description
    if (match.description) {
      md.appendMarkdown(`${match.description}\n\n`);
    }

    // Metadata
    if (match.metadata && Object.keys(match.metadata).length > 0) {
      md.appendMarkdown(`**Details:**\n`);
      for (const [key, value] of Object.entries(match.metadata)) {
        if (value) {
          md.appendMarkdown(`- *${this.formatMetadataKey(key)}:* ${value}\n`);
        }
      }
      md.appendMarkdown('\n');
    }

    // Patterns
    if (match.patterns && match.patterns.length > 0) {
      md.appendMarkdown(`**Patterns:** ${match.patterns.join(', ')}\n\n`);
    }

    // Related decisions
    if (match.relatedDecisions && match.relatedDecisions.length > 0) {
      md.appendMarkdown(`**Related ADRs:** ${match.relatedDecisions.join(', ')}\n\n`);
    }

    // Code examples
    if (match.codeExamples && match.codeExamples.length > 0) {
      md.appendMarkdown(`**Example:**\n`);
      md.appendCodeblock(match.codeExamples[0], 'typescript');
      md.appendMarkdown('\n');
    }

    // Source link
    md.appendMarkdown(`$(file) *Source: ${match.source}*\n\n`);

    return md;
  }

  /**
   * Create quick action links
   */
  private createQuickActions(match: ContextMatch): vscode.MarkdownString | undefined {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`**Quick Actions:** `);

    // Open file command
    const openFileUri = vscode.Uri.file(match.sourcePath);
    const openFileCommand = vscode.Uri.parse(
      `command:vscode.open?${encodeURIComponent(JSON.stringify([openFileUri]))}`
    );
    md.appendMarkdown(`[$(link-external) Open Source](${openFileCommand}) | `);

    // Refresh Memory Bank command
    const refreshCommand = vscode.Uri.parse(`command:egce.refreshMemoryBank`);
    md.appendMarkdown(`[$(refresh) Refresh](${refreshCommand})`);

    return md;
  }

  /**
   * Get icon for match type
   */
  private getMatchIcon(type: ContextMatchType): string {
    const icons: Record<ContextMatchType, string> = {
      [ContextMatchType.Function]: '$(symbol-method)',
      [ContextMatchType.Class]: '$(symbol-class)',
      [ContextMatchType.Module]: '$(symbol-namespace)',
      [ContextMatchType.Import]: '$(package)',
      [ContextMatchType.Pattern]: '$(symbol-misc)',
      [ContextMatchType.Decision]: '$(lightbulb)',
      [ContextMatchType.Convention]: '$(checklist)',
      [ContextMatchType.Knowledge]: '$(book)',
    };
    return icons[type] || '$(info)';
  }

  /**
   * Get human-readable type badge
   */
  private getTypeBadge(type: ContextMatchType): string {
    const badges: Record<ContextMatchType, string> = {
      [ContextMatchType.Function]: 'Function',
      [ContextMatchType.Class]: 'Class',
      [ContextMatchType.Module]: 'Module',
      [ContextMatchType.Import]: 'Import',
      [ContextMatchType.Pattern]: 'Pattern',
      [ContextMatchType.Decision]: 'ADR',
      [ContextMatchType.Convention]: 'Convention',
      [ContextMatchType.Knowledge]: 'Knowledge',
    };
    return badges[type] || 'Context';
  }

  /**
   * Format metadata key for display
   */
  private formatMetadataKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Load configuration from VS Code settings
   */
  loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('egce');
    this.isEnabled = config.get<boolean>('contextualHovers.enabled', true);
  }

  /**
   * Clear the hover cache
   */
  clearCache(): void {
    this.hoverCache.clear();
    this.contextMatcher.clearCache();
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    this.hoverCache.invalidateByPattern(filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    this.contextMatcher.invalidateFile(filePath);
  }

  /**
   * Get current enabled status
   */
  isFeatureEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set enabled status programmatically
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }
}

// ============================================
// Registration Helper
// ============================================

/**
 * Register the contextual hover provider for supported languages
 */
export function registerContextualHoverProvider(
  context: vscode.ExtensionContext,
  memoryBankService: MemoryBankService
): ContextualHoverProvider {
  const provider = new ContextualHoverProvider(memoryBankService);

  // Supported languages for hover
  const languages = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
    'ruby',
    'php',
    'kotlin',
    'scala',
    'swift',
  ];

  // Register for each language
  for (const language of languages) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language, scheme: 'file' },
        provider
      )
    );
  }

  // Also register for untitled files
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { scheme: 'untitled' },
      provider
    )
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('egce.contextualHovers')) {
        provider.loadConfiguration();
      }
    })
  );

  // Watch for Memory Bank file changes to invalidate cache
  const memoryBankPath = vscode.workspace
    .getConfiguration('egce')
    .get<string>('memoryBankPath', '.memory-bank');

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      vscode.workspace.workspaceFolders?.[0] ?? '',
      `${memoryBankPath}/**/*`
    )
  );

  context.subscriptions.push(
    watcher.onDidChange((uri) => provider.invalidateFile(uri.fsPath)),
    watcher.onDidCreate(() => provider.clearCache()),
    watcher.onDidDelete(() => provider.clearCache()),
    watcher
  );

  // Register command to toggle hovers
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.toggleContextualHovers', () => {
      const newState = !provider.isFeatureEnabled();
      provider.setEnabled(newState);

      vscode.window.showInformationMessage(
        `Memory Bank contextual hovers ${newState ? 'enabled' : 'disabled'}`
      );
    })
  );

  // Register command to clear hover cache
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.clearHoverCache', () => {
      provider.clearCache();
      vscode.window.showInformationMessage('Memory Bank hover cache cleared');
    })
  );

  return provider;
}
