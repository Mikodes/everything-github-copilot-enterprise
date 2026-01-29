/**
 * US-012: Real-time Collaboration - Presence Provider
 *
 * Implements AC-012.1: User Presence
 * Displays avatars of users viewing the same file in:
 * - Status bar
 * - Editor title bar
 * - Tree view sidebar
 */

import * as vscode from 'vscode';
import {
  CollaborationService,
  getCollaborationService,
} from '../services/CollaborationService';
import {
  Collaborator,
  ConnectionState,
  formatTimeAgo,
} from '../models/collaboration';

/**
 * Tree item representing a collaborator in the sidebar
 */
export class CollaboratorTreeItem extends vscode.TreeItem {
  constructor(
    public readonly collaborator: Collaborator,
    public readonly isCurrentFile: boolean
  ) {
    super(collaborator.user.name, vscode.TreeItemCollapsibleState.None);

    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIconPath();
    this.contextValue = 'collaborator';

    // Add command to go to collaborator's cursor
    if (collaborator.currentFile && collaborator.cursorPosition) {
      this.command = {
        command: 'egce.goToCollaboratorCursor',
        title: 'Go to Cursor',
        arguments: [collaborator],
      };
    }
  }

  private getDescription(): string {
    const parts: string[] = [];

    // Status indicator
    switch (this.collaborator.status) {
      case 'editing':
        parts.push('editing');
        break;
      case 'viewing':
        parts.push('viewing');
        break;
      case 'idle':
        parts.push('idle');
        break;
    }

    // Time ago
    parts.push(this.collaborator.timeAgo);

    return parts.join(' - ');
  }

  private getTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.supportHtml = true;

    md.appendMarkdown(`### ${this.collaborator.user.name}\n\n`);

    // Status with color
    const statusEmoji = this.getStatusEmoji();
    md.appendMarkdown(`**Status:** ${statusEmoji} ${this.collaborator.status}\n\n`);

    // Current file
    if (this.collaborator.currentFile) {
      const fileName = this.collaborator.currentFile.split('/').pop() || this.collaborator.currentFile;
      md.appendMarkdown(`**File:** \`${fileName}\`\n\n`);
    }

    // Cursor position
    if (this.collaborator.cursorPosition) {
      md.appendMarkdown(
        `**Cursor:** Line ${this.collaborator.cursorPosition.line + 1}, Column ${this.collaborator.cursorPosition.column + 1}\n\n`
      );
    }

    // Last activity
    md.appendMarkdown(`**Last activity:** ${this.collaborator.timeAgo}\n`);

    return md;
  }

  private getStatusEmoji(): string {
    switch (this.collaborator.status) {
      case 'online':
        return '🟢';
      case 'editing':
        return '✏️';
      case 'viewing':
        return '👀';
      case 'idle':
        return '💤';
      case 'offline':
        return '⚫';
      default:
        return '⚪';
    }
  }

  private getIconPath(): vscode.ThemeIcon {
    // Use colored circle based on user's assigned color
    switch (this.collaborator.status) {
      case 'editing':
        return new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.green'));
      case 'viewing':
        return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.blue'));
      case 'idle':
        return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
      case 'offline':
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.red'));
      default:
        return new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.purple'));
    }
  }
}

/**
 * Category tree item (e.g., "In This File", "In Other Files")
 */
export class PresenceCategoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collaborators: Collaborator[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = `(${collaborators.length})`;
    this.contextValue = 'presenceCategory';
  }
}

/**
 * Tree data provider for collaborator presence
 */
export class PresenceProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private collaborationService: CollaborationService;
  private collaborators: Collaborator[] = [];
  private currentFile: string | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.collaborationService = getCollaborationService();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for presence changes
    this.disposables.push(
      this.collaborationService.onPresenceChanged((presences) => {
        this.collaborators = this.collaborationService.getCollaborators();
        this.refresh();
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.currentFile = editor?.document.uri.fsPath ?? null;
        this.refresh();
      })
    );

    // Listen for connection state changes
    this.disposables.push(
      this.collaborationService.onConnectionStateChanged(() => {
        this.refresh();
      })
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element instanceof PresenceCategoryItem) {
      return element.collaborators.map(
        (c) => new CollaboratorTreeItem(c, c.currentFile === this.currentFile)
      );
    }

    if (!element) {
      const connectionState = this.collaborationService.getConnectionState();

      // Show connection status if not connected
      if (connectionState !== 'connected') {
        return [this.getConnectionStatusItem(connectionState)];
      }

      this.collaborators = this.collaborationService.getCollaborators();

      if (this.collaborators.length === 0) {
        const item = new vscode.TreeItem('No other collaborators online');
        item.iconPath = new vscode.ThemeIcon('info');
        return [item];
      }

      // Group collaborators by file context
      const inCurrentFile = this.collaborators.filter(
        (c) => c.currentFile === this.currentFile
      );
      const inOtherFiles = this.collaborators.filter(
        (c) => c.currentFile !== this.currentFile
      );

      const items: vscode.TreeItem[] = [];

      if (inCurrentFile.length > 0) {
        items.push(
          new PresenceCategoryItem(
            'In This File',
            inCurrentFile,
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      }

      if (inOtherFiles.length > 0) {
        items.push(
          new PresenceCategoryItem(
            'In Other Files',
            inOtherFiles,
            vscode.TreeItemCollapsibleState.Collapsed
          )
        );
      }

      return items;
    }

    return [];
  }

  private getConnectionStatusItem(state: ConnectionState): vscode.TreeItem {
    const item = new vscode.TreeItem(this.getConnectionStatusLabel(state));
    item.iconPath = this.getConnectionStatusIcon(state);
    item.contextValue = 'connectionStatus';

    if (state === 'disconnected' || state === 'error') {
      item.command = {
        command: 'egce.startCollaboration',
        title: 'Connect',
      };
      item.description = 'Click to connect';
    }

    return item;
  }

  private getConnectionStatusLabel(state: ConnectionState): string {
    switch (state) {
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown Status';
    }
  }

  private getConnectionStatusIcon(state: ConnectionState): vscode.ThemeIcon {
    switch (state) {
      case 'connecting':
      case 'reconnecting':
        return new vscode.ThemeIcon('sync~spin');
      case 'disconnected':
        return new vscode.ThemeIcon('plug', new vscode.ThemeColor('charts.yellow'));
      case 'error':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      default:
        return new vscode.ThemeIcon('question');
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Status bar item showing collaborator count and presence
 */
export class PresenceStatusBarItem implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private collaborationService: CollaborationService;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.collaborationService = getCollaborationService();

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'egce.showCollaborators';

    this.setupEventListeners();
    this.update();
    this.statusBarItem.show();
  }

  private setupEventListeners(): void {
    this.disposables.push(
      this.collaborationService.onPresenceChanged(() => this.update())
    );

    this.disposables.push(
      this.collaborationService.onConnectionStateChanged(() => this.update())
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.update())
    );
  }

  private update(): void {
    const connectionState = this.collaborationService.getConnectionState();

    if (connectionState !== 'connected') {
      this.statusBarItem.text = '$(plug) Offline';
      this.statusBarItem.tooltip = 'Click to connect to collaboration';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    const collaborators = this.collaborationService.getCollaborators();
    const activeEditor = vscode.window.activeTextEditor;
    const currentFile = activeEditor?.document.uri.fsPath;

    const inCurrentFile = collaborators.filter(
      (c) => c.currentFile === currentFile
    );

    if (collaborators.length === 0) {
      this.statusBarItem.text = '$(account) Solo';
      this.statusBarItem.tooltip = 'No other collaborators online';
    } else if (inCurrentFile.length > 0) {
      const names = inCurrentFile.slice(0, 3).map((c) => c.user.name).join(', ');
      const extra = inCurrentFile.length > 3 ? ` +${inCurrentFile.length - 3}` : '';
      this.statusBarItem.text = `$(organization) ${inCurrentFile.length} here`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**In this file:** ${names}${extra}\n\n` +
        `**Total online:** ${collaborators.length} collaborator(s)`
      );
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.text = `$(organization) ${collaborators.length} online`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**${collaborators.length} collaborator(s) online**\n\n` +
        collaborators.slice(0, 5).map((c) => `- ${c.user.name} (${c.status})`).join('\n')
      );
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Editor title decoration showing collaborators in the current file
 */
export class PresenceEditorDecoration implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;
  private collaborationService: CollaborationService;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.collaborationService = getCollaborationService();

    // Create decoration type for presence indicator
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 1em',
        contentText: '',
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.disposables.push(
      this.collaborationService.onPresenceChanged(() => this.updateDecorations())
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations())
    );
  }

  private updateDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const currentFile = editor.document.uri.fsPath;
    const collaborators = this.collaborationService.getCollaboratorsInFile(currentFile);

    // Note: VS Code doesn't support dynamic title bar decorations
    // This is a placeholder for when/if that feature becomes available
    // For now, the status bar and tree view provide the presence information
  }

  dispose(): void {
    this.decorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Register presence provider components
 */
export function registerPresenceProvider(
  context: vscode.ExtensionContext
): {
  treeProvider: PresenceProvider;
  statusBarItem: PresenceStatusBarItem;
} {
  const treeProvider = new PresenceProvider();
  const statusBarItem = new PresenceStatusBarItem();

  // Register tree view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('memoryBankCollaborators', treeProvider)
  );

  context.subscriptions.push(treeProvider);
  context.subscriptions.push(statusBarItem);

  return { treeProvider, statusBarItem };
}
