/**
 * US-012: Real-time Collaboration - Cursor Decoration Provider
 *
 * Implements AC-012.2: Cursor Tracking
 * Shows optional indicators of other users' cursors and selections
 */

import * as vscode from 'vscode';
import {
  CollaborationService,
  getCollaborationService,
} from '../services/CollaborationService';
import {
  CursorPosition,
  SelectionRange,
  CursorChangedPayload,
  SelectionChangedPayload,
  Collaborator,
  getUserColor,
} from '../models/collaboration';

/**
 * Tracked cursor for a remote user
 */
interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  file: string;
  position: CursorPosition;
  decorationType: vscode.TextEditorDecorationType;
  labelDecorationType: vscode.TextEditorDecorationType;
  lastUpdate: number;
}

/**
 * Tracked selection for a remote user
 */
interface RemoteSelection {
  userId: string;
  userName: string;
  color: string;
  file: string;
  selection: SelectionRange;
  decorationType: vscode.TextEditorDecorationType;
  lastUpdate: number;
}

/**
 * Provider for rendering remote users' cursors and selections
 */
export class CursorDecorationProvider implements vscode.Disposable {
  private collaborationService: CollaborationService;
  private cursors: Map<string, RemoteCursor> = new Map();
  private selections: Map<string, RemoteSelection> = new Map();
  private disposables: vscode.Disposable[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private enabled: boolean = true;

  // Cursor fade timeout (ms) - cursors fade after this time of inactivity
  private readonly CURSOR_TIMEOUT_MS = 60000; // 1 minute

  constructor() {
    this.collaborationService = getCollaborationService();
    this.loadConfiguration();
    this.setupEventListeners();
    this.startCleanupInterval();
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('egce.collaboration');
    this.enabled = config.get<boolean>('showCursors', true);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for cursor updates
    this.disposables.push(
      this.collaborationService.onCursorChanged((payload) => {
        if (this.enabled) {
          this.updateCursor(payload);
        }
      })
    );

    // Listen for selection updates
    this.disposables.push(
      this.collaborationService.onSelectionChanged((payload) => {
        if (this.enabled) {
          this.updateSelection(payload);
        }
      })
    );

    // Listen for user left events
    this.disposables.push(
      this.collaborationService.onUserLeft((user) => {
        this.removeCursor(user.id);
        this.removeSelection(user.id);
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.refreshDecorations();
      })
    );

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('egce.collaboration.showCursors')) {
          this.loadConfiguration();
          if (!this.enabled) {
            this.clearAllDecorations();
          } else {
            this.refreshDecorations();
          }
        }
      })
    );
  }

  /**
   * Update cursor for a remote user
   */
  private updateCursor(payload: CursorChangedPayload): void {
    const existingCursor = this.cursors.get(payload.userId);

    // Clean up old decoration types
    if (existingCursor) {
      existingCursor.decorationType.dispose();
      existingCursor.labelDecorationType.dispose();
    }

    // Create new decoration types with the user's color
    const color = payload.color || getUserColor(payload.userId);

    const cursorDecorationType = vscode.window.createTextEditorDecorationType({
      borderStyle: 'solid',
      borderColor: color,
      borderWidth: '2px 0 0 2px',
      backgroundColor: `${color}20`,
    });

    const labelDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ` ${payload.userName}`,
        color: color,
        backgroundColor: `${color}30`,
        fontWeight: 'bold',
        fontSize: '0.8em',
        margin: '0 0 0 0.5em',
        border: `1px solid ${color}`,
        borderRadius: '3px',
      },
    });

    const cursor: RemoteCursor = {
      userId: payload.userId,
      userName: payload.userName,
      color,
      file: payload.file,
      position: payload.position,
      decorationType: cursorDecorationType,
      labelDecorationType,
      lastUpdate: Date.now(),
    };

    this.cursors.set(payload.userId, cursor);
    this.applyCursorDecoration(cursor);
  }

  /**
   * Update selection for a remote user
   */
  private updateSelection(payload: SelectionChangedPayload): void {
    const existingSelection = this.selections.get(payload.userId);

    // Clean up old decoration type
    if (existingSelection) {
      existingSelection.decorationType.dispose();
    }

    // If selection is null, just remove it
    if (!payload.selection) {
      this.selections.delete(payload.userId);
      this.refreshDecorations();
      return;
    }

    const color = payload.color || getUserColor(payload.userId);

    const selectionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: `${color}30`,
      borderStyle: 'solid',
      borderColor: color,
      borderWidth: '1px',
      isWholeLine: false,
    });

    const selection: RemoteSelection = {
      userId: payload.userId,
      userName: payload.userName,
      color,
      file: payload.file,
      selection: payload.selection,
      decorationType: selectionDecorationType,
      lastUpdate: Date.now(),
    };

    this.selections.set(payload.userId, selection);
    this.applySelectionDecoration(selection);
  }

  /**
   * Apply cursor decoration to active editor
   */
  private applyCursorDecoration(cursor: RemoteCursor): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Only show cursor if it's in the current file
    if (editor.document.uri.fsPath !== cursor.file) return;

    const position = new vscode.Position(cursor.position.line, cursor.position.column);
    const range = new vscode.Range(position, position);

    // Apply cursor decoration (small indicator)
    editor.setDecorations(cursor.decorationType, [
      {
        range,
        hoverMessage: new vscode.MarkdownString(`**${cursor.userName}** is here`),
      },
    ]);

    // Apply label decoration (name tag)
    const labelRange = new vscode.Range(position, position);
    editor.setDecorations(cursor.labelDecorationType, [{ range: labelRange }]);
  }

  /**
   * Apply selection decoration to active editor
   */
  private applySelectionDecoration(selection: RemoteSelection): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Only show selection if it's in the current file
    if (editor.document.uri.fsPath !== selection.file) return;

    const startPosition = new vscode.Position(
      selection.selection.start.line,
      selection.selection.start.column
    );
    const endPosition = new vscode.Position(
      selection.selection.end.line,
      selection.selection.end.column
    );
    const range = new vscode.Range(startPosition, endPosition);

    editor.setDecorations(selection.decorationType, [
      {
        range,
        hoverMessage: new vscode.MarkdownString(`**${selection.userName}** selected this`),
      },
    ]);
  }

  /**
   * Remove cursor for a user
   */
  private removeCursor(userId: string): void {
    const cursor = this.cursors.get(userId);
    if (cursor) {
      cursor.decorationType.dispose();
      cursor.labelDecorationType.dispose();
      this.cursors.delete(userId);
    }
  }

  /**
   * Remove selection for a user
   */
  private removeSelection(userId: string): void {
    const selection = this.selections.get(userId);
    if (selection) {
      selection.decorationType.dispose();
      this.selections.delete(userId);
    }
  }

  /**
   * Refresh all decorations for the active editor
   */
  private refreshDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const currentFile = editor.document.uri.fsPath;

    // Apply all cursors for the current file
    for (const cursor of this.cursors.values()) {
      if (cursor.file === currentFile) {
        this.applyCursorDecoration(cursor);
      } else {
        // Clear decorations for cursors in other files
        editor.setDecorations(cursor.decorationType, []);
        editor.setDecorations(cursor.labelDecorationType, []);
      }
    }

    // Apply all selections for the current file
    for (const selection of this.selections.values()) {
      if (selection.file === currentFile) {
        this.applySelectionDecoration(selection);
      } else {
        // Clear decorations for selections in other files
        editor.setDecorations(selection.decorationType, []);
      }
    }
  }

  /**
   * Clear all decorations
   */
  private clearAllDecorations(): void {
    for (const cursor of this.cursors.values()) {
      cursor.decorationType.dispose();
      cursor.labelDecorationType.dispose();
    }
    this.cursors.clear();

    for (const selection of this.selections.values()) {
      selection.decorationType.dispose();
    }
    this.selections.clear();
  }

  /**
   * Start cleanup interval to remove stale cursors
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      // Remove stale cursors
      for (const [userId, cursor] of this.cursors.entries()) {
        if (now - cursor.lastUpdate > this.CURSOR_TIMEOUT_MS) {
          this.removeCursor(userId);
        }
      }

      // Remove stale selections
      for (const [userId, selection] of this.selections.entries()) {
        if (now - selection.lastUpdate > this.CURSOR_TIMEOUT_MS) {
          this.removeSelection(userId);
        }
      }

      this.refreshDecorations();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Toggle cursor visibility
   */
  toggle(): void {
    this.enabled = !this.enabled;

    const config = vscode.workspace.getConfiguration('egce.collaboration');
    config.update('showCursors', this.enabled, vscode.ConfigurationTarget.Global);

    if (!this.enabled) {
      this.clearAllDecorations();
    } else {
      this.refreshDecorations();
    }
  }

  /**
   * Check if cursors are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get all remote cursors in the current file
   */
  getCursorsInCurrentFile(): RemoteCursor[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];

    const currentFile = editor.document.uri.fsPath;
    return Array.from(this.cursors.values()).filter((c) => c.file === currentFile);
  }

  /**
   * Go to a specific user's cursor
   */
  goToCursor(userId: string): void {
    const cursor = this.cursors.get(userId);
    if (!cursor) {
      vscode.window.showWarningMessage('Cursor not found');
      return;
    }

    // Open the file if not already open
    vscode.workspace.openTextDocument(cursor.file).then((doc) => {
      vscode.window.showTextDocument(doc).then((editor) => {
        const position = new vscode.Position(cursor.position.line, cursor.position.column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      });
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.clearAllDecorations();
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Register cursor decoration provider
 */
export function registerCursorDecorationProvider(
  context: vscode.ExtensionContext
): CursorDecorationProvider {
  const provider = new CursorDecorationProvider();
  context.subscriptions.push(provider);
  return provider;
}
