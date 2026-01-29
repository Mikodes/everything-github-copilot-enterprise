import * as vscode from 'vscode';
import { MemoryBankExplorerProvider } from './providers/MemoryBankExplorerProvider';
import { AgentsProvider } from './providers/AgentsProvider';
import { DecisionsProvider } from './providers/DecisionsProvider';
import { registerSlashCommandCompletionProvider } from './providers/SlashCommandCompletionProvider';
import { registerContextualHoverProvider } from './providers/ContextualHoverProvider';
import { registerAdrBadgeDecorationProvider } from './providers/AdrBadgeDecorationProvider';
import { registerPresenceProvider } from './providers/PresenceProvider';
import { registerCursorDecorationProvider } from './providers/CursorDecorationProvider';
import { registerCollaborationChatProvider } from './providers/CollaborationChatProvider';
import { registerCommands } from './commands';
import { MemoryBankService } from './services/MemoryBankService';
import { getCollaborationService } from './services/CollaborationService';
import { getMemoryBankChatParticipant, getEgceChatParticipant } from './chat';

let memoryBankService: MemoryBankService;

export function activate(context: vscode.ExtensionContext): void {
  console.log('EGCE Memory Bank extension is now active');

  // Initialize the Memory Bank service
  memoryBankService = new MemoryBankService();

  // Create tree data providers
  const memoryBankExplorerProvider = new MemoryBankExplorerProvider(
    memoryBankService
  );
  const agentsProvider = new AgentsProvider(memoryBankService);
  const decisionsProvider = new DecisionsProvider(memoryBankService);

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'memoryBankExplorer',
      memoryBankExplorerProvider
    ),
    vscode.window.registerTreeDataProvider('memoryBankAgents', agentsProvider),
    vscode.window.registerTreeDataProvider(
      'memoryBankDecisions',
      decisionsProvider
    )
  );

  // Register slash command completion provider (US-008)
  registerSlashCommandCompletionProvider(context, memoryBankService);

  // Register contextual hover provider (US-010)
  registerContextualHoverProvider(context, memoryBankService);

  // Register ADR badge decoration provider (US-011)
  const adrBadgeProvider = registerAdrBadgeDecorationProvider(context, memoryBankService);

  // ============================================
  // US-012: Real-time Collaboration
  // ============================================

  // Get collaboration service
  const collaborationService = getCollaborationService();
  context.subscriptions.push(collaborationService);

  // Register presence provider (AC-012.1: User Presence)
  const { treeProvider: presenceProvider, statusBarItem } = registerPresenceProvider(context);

  // Register cursor decoration provider (AC-012.2: Cursor Tracking)
  const cursorProvider = registerCursorDecorationProvider(context);

  // Register collaboration chat provider (AC-012.3: Quick Chat)
  const chatProvider = registerCollaborationChatProvider(context);

  // ============================================
  // US-013: Custom Chat Participant @egce
  // ============================================

  // Register Memory Bank Chat Participant (US-007)
  const memoryBankParticipant = getMemoryBankChatParticipant();
  memoryBankParticipant.register(context);

  // Register EGCE Chat Participant (US-013)
  // AC-013.1: Responds with complete Memory Bank knowledge
  // AC-013.2: Loads context from multiple files automatically
  // AC-013.3: Applies team standards in code suggestions
  // AC-013.4: Supports 3 operating modes (architect, dev, review)
  // AC-013.5: Integrates with 8 core agents
  const egceParticipant = getEgceChatParticipant();
  egceParticipant.register(context);

  // Register all commands (including collaboration commands from US-012)
  registerCommands(
    context,
    memoryBankService,
    memoryBankExplorerProvider,
    agentsProvider,
    decisionsProvider,
    collaborationService,
    cursorProvider,
    presenceProvider,
    chatProvider
  );

  // Auto-connect to collaboration if enabled
  const autoConnect = vscode.workspace
    .getConfiguration('egce.collaboration')
    .get<boolean>('autoConnect', false);

  if (autoConnect) {
    collaborationService.connect().catch((error) => {
      console.warn('Failed to auto-connect to collaboration:', error);
    });
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('egce')) {
        memoryBankExplorerProvider.refresh();
        agentsProvider.refresh();
        decisionsProvider.refresh();
      }
    })
  );

  // Watch for file changes in .memory-bank directory
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
    watcher.onDidChange(() => {
      memoryBankExplorerProvider.refresh();
      decisionsProvider.refresh();
      adrBadgeProvider.refreshAllDecorations();
    }),
    watcher.onDidCreate(() => {
      memoryBankExplorerProvider.refresh();
      decisionsProvider.refresh();
      adrBadgeProvider.refreshAllDecorations();
    }),
    watcher.onDidDelete(() => {
      memoryBankExplorerProvider.refresh();
      decisionsProvider.refresh();
      adrBadgeProvider.refreshAllDecorations();
    }),
    watcher
  );

  // Auto-validate on save if enabled
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const autoValidate = vscode.workspace
        .getConfiguration('egce')
        .get<boolean>('autoValidate', true);

      if (autoValidate && document.uri.fsPath.includes(memoryBankPath)) {
        const diagnostics = await memoryBankService.validateFile(document.uri);
        if (diagnostics.length > 0) {
          vscode.window.showWarningMessage(
            `Memory Bank validation: ${diagnostics.length} issue(s) found`
          );
        }
      }
    })
  );

  // Show welcome message if Memory Bank exists
  memoryBankService.hasMemoryBank().then((exists) => {
    if (exists) {
      vscode.window.showInformationMessage(
        'EGCE Memory Bank detected and loaded'
      );
    }
  });
}

export function deactivate(): void {
  console.log('EGCE Memory Bank extension is now deactivated');
}
