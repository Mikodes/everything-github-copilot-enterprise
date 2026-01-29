import * as vscode from 'vscode';
import { MemoryBankExplorerProvider } from './providers/MemoryBankExplorerProvider';
import { AgentsProvider } from './providers/AgentsProvider';
import { DecisionsProvider } from './providers/DecisionsProvider';
import { registerSlashCommandCompletionProvider } from './providers/SlashCommandCompletionProvider';
import { registerCommands } from './commands';
import { MemoryBankService } from './services/MemoryBankService';
import { getMemoryBankChatParticipant } from './chat';

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

  // Register all commands
  registerCommands(
    context,
    memoryBankService,
    memoryBankExplorerProvider,
    agentsProvider,
    decisionsProvider
  );

  // Register slash command completion provider (US-008)
  registerSlashCommandCompletionProvider(context, memoryBankService);

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
    }),
    watcher.onDidCreate(() => {
      memoryBankExplorerProvider.refresh();
      decisionsProvider.refresh();
    }),
    watcher.onDidDelete(() => {
      memoryBankExplorerProvider.refresh();
      decisionsProvider.refresh();
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
