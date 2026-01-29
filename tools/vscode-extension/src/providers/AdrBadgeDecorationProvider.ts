/**
 * US-011: ADR Badge Decoration Provider
 *
 * Implements T-011.1: DecorationType for badges in editor gutter.
 * Shows visual indicators when code lines have related Architecture Decision Records.
 *
 * Acceptance Criteria:
 * - AC-011.1: Badge in editor gutter for lines with ADRs
 * - AC-011.2: Click on badge opens the related ADR
 * - AC-011.3: Different icons based on decision status
 * - AC-011.4: Tooltip with ADR summary
 * - AC-011.5: Works with VS Code decorators
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MemoryBankService, Decision } from '../services/MemoryBankService';
import { AdrCodeMapper, AdrMapping, AdrMatchType } from '../services/AdrCodeMapper';

// ============================================
// Types
// ============================================

interface DecorationsByStatus {
  proposed: vscode.TextEditorDecorationType;
  accepted: vscode.TextEditorDecorationType;
  deprecated: vscode.TextEditorDecorationType;
  superseded: vscode.TextEditorDecorationType;
}

interface LineDecoration {
  lineNumber: number;
  decision: Decision;
  matchType: AdrMatchType;
  summary: string;
}

// ============================================
// ADR Badge Decoration Provider
// ============================================

export class AdrBadgeDecorationProvider implements vscode.Disposable {
  private decorationTypes: DecorationsByStatus;
  private adrCodeMapper: AdrCodeMapper;
  private disposables: vscode.Disposable[] = [];
  private activeDecorations: Map<string, LineDecoration[]> = new Map();
  private updateDebounceTimer: NodeJS.Timeout | undefined;
  private extensionPath: string;

  constructor(
    context: vscode.ExtensionContext,
    memoryBankService: MemoryBankService
  ) {
    this.extensionPath = context.extensionPath;
    this.adrCodeMapper = new AdrCodeMapper(memoryBankService);
    this.decorationTypes = this.createDecorationTypes();

    // Register event handlers
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDecorations(editor);
        }
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          this.debounceUpdate(editor);
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('egce.adrBadges')) {
          this.refreshAllDecorations();
        }
      })
    );

    // Initial decoration for active editor
    if (vscode.window.activeTextEditor) {
      this.updateDecorations(vscode.window.activeTextEditor);
    }
  }

  /**
   * Create decoration types for each ADR status
   */
  private createDecorationTypes(): DecorationsByStatus {
    return {
      proposed: this.createDecorationType('proposed', 'adr-proposed.svg'),
      accepted: this.createDecorationType('accepted', 'adr-accepted.svg'),
      deprecated: this.createDecorationType('deprecated', 'adr-deprecated.svg'),
      superseded: this.createDecorationType('superseded', 'adr-superseded.svg'),
    };
  }

  /**
   * Create a single decoration type for an ADR status
   */
  private createDecorationType(
    status: string,
    iconFileName: string
  ): vscode.TextEditorDecorationType {
    const iconPath = path.join(this.extensionPath, 'resources', iconFileName);

    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: iconPath,
      gutterIconSize: 'contain',
      overviewRulerColor: this.getStatusColor(status),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  /**
   * Get color for ADR status
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'proposed':
        return '#E5A00D';
      case 'accepted':
        return '#3FB950';
      case 'deprecated':
        return '#D29922';
      case 'superseded':
        return '#58A6FF';
      default:
        return '#6E7681';
    }
  }

  /**
   * Debounce decoration updates for performance
   */
  private debounceUpdate(editor: vscode.TextEditor): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    this.updateDebounceTimer = setTimeout(() => {
      this.updateDecorations(editor);
    }, 500);
  }

  /**
   * Update decorations for an editor
   */
  async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    // Check if feature is enabled
    const config = vscode.workspace.getConfiguration('egce');
    if (!config.get<boolean>('adrBadges.enabled', true)) {
      this.clearDecorations(editor);
      return;
    }

    // Check if language is supported
    const supportedLanguages = [
      'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
      'python', 'java', 'csharp', 'go', 'rust', 'ruby', 'php',
      'kotlin', 'scala', 'swift', 'c', 'cpp',
    ];

    if (!supportedLanguages.includes(editor.document.languageId)) {
      this.clearDecorations(editor);
      return;
    }

    try {
      // Get ADR mappings for the document
      const mappings = await this.adrCodeMapper.findMappings(editor.document);

      // Group decorations by status
      const decorationsByStatus: Record<string, vscode.DecorationOptions[]> = {
        proposed: [],
        accepted: [],
        deprecated: [],
        superseded: [],
      };

      // Track line decorations for click handling
      const lineDecorations: LineDecoration[] = [];

      for (const mapping of mappings) {
        const status = mapping.decision.status;
        const range = new vscode.Range(
          mapping.lineNumber,
          0,
          mapping.lineNumber,
          0
        );

        const hoverMessage = this.createHoverMessage(mapping);

        decorationsByStatus[status].push({
          range,
          hoverMessage,
        });

        lineDecorations.push({
          lineNumber: mapping.lineNumber,
          decision: mapping.decision,
          matchType: mapping.matchType,
          summary: mapping.summary,
        });
      }

      // Apply decorations
      editor.setDecorations(this.decorationTypes.proposed, decorationsByStatus.proposed);
      editor.setDecorations(this.decorationTypes.accepted, decorationsByStatus.accepted);
      editor.setDecorations(this.decorationTypes.deprecated, decorationsByStatus.deprecated);
      editor.setDecorations(this.decorationTypes.superseded, decorationsByStatus.superseded);

      // Store decorations for click handling
      this.activeDecorations.set(editor.document.uri.toString(), lineDecorations);
    } catch (error) {
      console.error('Error updating ADR decorations:', error);
    }
  }

  /**
   * Create hover message for a decoration
   */
  private createHoverMessage(mapping: AdrMapping): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    // Status badge
    const statusIcon = this.getStatusIcon(mapping.decision.status);
    const statusBadge = `**${statusIcon} ${mapping.decision.status.toUpperCase()}**`;

    // Header
    md.appendMarkdown(`### ADR-${mapping.decision.id}: ${mapping.decision.title}\n\n`);
    md.appendMarkdown(`${statusBadge}\n\n`);

    // Match info
    const matchLabel = this.getMatchTypeLabel(mapping.matchType);
    md.appendMarkdown(`*Matched by: ${matchLabel}* (\`${mapping.matchedText}\`)\n\n`);

    // Summary
    if (mapping.summary) {
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`${mapping.summary}\n\n`);
    }

    // Action link
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(
      `[$(link-external) Open ADR](command:egce.openAdrFromBadge?${encodeURIComponent(
        JSON.stringify({ filePath: mapping.decision.filePath })
      )})`
    );

    return md;
  }

  /**
   * Get icon for ADR status
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'proposed':
        return '$(question)';
      case 'accepted':
        return '$(check)';
      case 'deprecated':
        return '$(warning)';
      case 'superseded':
        return '$(arrow-swap)';
      default:
        return '$(circle-outline)';
    }
  }

  /**
   * Get label for match type
   */
  private getMatchTypeLabel(matchType: AdrMatchType): string {
    switch (matchType) {
      case AdrMatchType.DirectReference:
        return 'Direct reference';
      case AdrMatchType.PatternMatch:
        return 'Design pattern';
      case AdrMatchType.ModuleMatch:
        return 'Module path';
      case AdrMatchType.TechnologyMatch:
        return 'Technology';
      case AdrMatchType.KeywordMatch:
        return 'Keyword';
      default:
        return 'Match';
    }
  }

  /**
   * Clear decorations from an editor
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationTypes.proposed, []);
    editor.setDecorations(this.decorationTypes.accepted, []);
    editor.setDecorations(this.decorationTypes.deprecated, []);
    editor.setDecorations(this.decorationTypes.superseded, []);
    this.activeDecorations.delete(editor.document.uri.toString());
  }

  /**
   * Refresh decorations in all visible editors
   */
  async refreshAllDecorations(): Promise<void> {
    this.adrCodeMapper.clearCache();
    for (const editor of vscode.window.visibleTextEditors) {
      await this.updateDecorations(editor);
    }
  }

  /**
   * Get ADR at a specific line in a document
   */
  getAdrAtLine(documentUri: string, lineNumber: number): LineDecoration | undefined {
    const decorations = this.activeDecorations.get(documentUri);
    if (!decorations) {
      return undefined;
    }
    return decorations.find((d) => d.lineNumber === lineNumber);
  }

  /**
   * Get all ADRs in a document
   */
  getAdrsInDocument(documentUri: string): LineDecoration[] {
    return this.activeDecorations.get(documentUri) || [];
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.decorationTypes.proposed.dispose();
    this.decorationTypes.accepted.dispose();
    this.decorationTypes.deprecated.dispose();
    this.decorationTypes.superseded.dispose();

    this.disposables.forEach((d) => d.dispose());
  }
}

// ============================================
// Registration Function
// ============================================

/**
 * Register the ADR Badge Decoration Provider
 */
export function registerAdrBadgeDecorationProvider(
  context: vscode.ExtensionContext,
  memoryBankService: MemoryBankService
): AdrBadgeDecorationProvider {
  const provider = new AdrBadgeDecorationProvider(context, memoryBankService);
  context.subscriptions.push(provider);

  // Register command for opening ADR from badge click
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.openAdrFromBadge', async (args: { filePath: string }) => {
      if (args?.filePath) {
        const uri = vscode.Uri.file(args.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
      }
    })
  );

  // Register command to toggle ADR badges
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.toggleAdrBadges', async () => {
      const config = vscode.workspace.getConfiguration('egce');
      const currentValue = config.get<boolean>('adrBadges.enabled', true);
      await config.update('adrBadges.enabled', !currentValue, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage(
        `ADR Badges ${!currentValue ? 'enabled' : 'disabled'}`
      );
    })
  );

  // Register command to refresh ADR badges
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.refreshAdrBadges', async () => {
      await provider.refreshAllDecorations();
      vscode.window.showInformationMessage('ADR Badges refreshed');
    })
  );

  // Register command to navigate to ADR at cursor line
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.navigateToAdrAtLine', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const lineNumber = editor.selection.active.line;
      const decoration = provider.getAdrAtLine(editor.document.uri.toString(), lineNumber);

      if (decoration) {
        const uri = vscode.Uri.file(decoration.decision.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
      } else {
        // Check if there are any ADRs in the document
        const allAdrs = provider.getAdrsInDocument(editor.document.uri.toString());
        if (allAdrs.length > 0) {
          // Show quick pick to select an ADR
          const items = allAdrs.map((adr) => ({
            label: `ADR-${adr.decision.id}: ${adr.decision.title}`,
            description: `Line ${adr.lineNumber + 1} - ${adr.decision.status}`,
            detail: adr.summary,
            filePath: adr.decision.filePath,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an ADR to open',
          });

          if (selected) {
            const uri = vscode.Uri.file(selected.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
          }
        } else {
          vscode.window.showInformationMessage('No related ADRs found in this file');
        }
      }
    })
  );

  return provider;
}
