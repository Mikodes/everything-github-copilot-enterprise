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
import {
  getAgentModeProvider,
  getPatternValidator,
  getTemplateProvider,
  getAdrDraftGenerator,
} from './agent';

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

  // ============================================
  // US-014: Integración con Copilot Agent Mode
  // ============================================

  // Register Agent Mode Provider (AC-014.1: Agent Mode receives project context automatically)
  // Provides Language Model Tools for Copilot Agent Mode integration
  const agentModeProvider = getAgentModeProvider();
  agentModeProvider.register(context);

  // Initialize Pattern Validator (AC-014.2: Respects documented architecture patterns)
  // AC-014.4: Validates changes against team standards before applying
  const patternValidator = getPatternValidator();
  patternValidator.initialize().catch((error) => {
    console.warn('Failed to initialize PatternValidator:', error);
  });

  // Initialize Template Provider (AC-014.3: Uses Memory Bank templates for code generation)
  const templateProvider = getTemplateProvider();
  templateProvider.initialize().catch((error) => {
    console.warn('Failed to initialize TemplateProvider:', error);
  });

  // Initialize ADR Draft Generator (AC-014.5: Generates ADR drafts when making architectural changes)
  const adrDraftGenerator = getAdrDraftGenerator();
  adrDraftGenerator.initialize().catch((error) => {
    console.warn('Failed to initialize AdrDraftGenerator:', error);
  });

  // Register Agent Mode commands
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.validateCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const code = editor.document.getText();
      const result = await patternValidator.validateCode(code, {
        language: editor.document.languageId,
        filePath: editor.document.uri.fsPath,
      });

      if (result.valid) {
        vscode.window.showInformationMessage(
          `Code validation passed with score ${result.score}/100`
        );
      } else {
        vscode.window.showWarningMessage(
          `Code validation found ${result.violations.length} violation(s). Score: ${result.score}/100`
        );
      }
    }),

    vscode.commands.registerCommand('egce.generateAdr', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Enter ADR title',
        placeHolder: 'e.g., Use Repository Pattern for Data Access',
      });

      if (!title) return;

      const context = await vscode.window.showInputBox({
        prompt: 'Enter context (optional)',
        placeHolder: 'Describe the problem or situation',
      });

      const adr = await adrDraftGenerator.generateAdrDraft({
        title,
        context: context || undefined,
      });

      const filePath = await adrDraftGenerator.saveAdr(adr);
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);

      vscode.window.showInformationMessage(`ADR ${adr.id} created successfully`);
    }),

    vscode.commands.registerCommand('egce.detectAdrRequirement', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const code = editor.document.getText();
      const result = await adrDraftGenerator.detectAdrRequirement(code, [
        editor.document.uri.fsPath,
      ]);

      if (result.requiresAdr) {
        const action = await vscode.window.showInformationMessage(
          `ADR recommended (confidence: ${Math.round(result.confidence * 100)}%): ${result.suggestedTitle}`,
          'Generate ADR',
          'Dismiss'
        );

        if (action === 'Generate ADR') {
          const adr = await adrDraftGenerator.generateAdrDraft({
            title: result.suggestedTitle,
            context: result.suggestedContext,
            codeChanges: code,
            affectedFiles: [editor.document.uri.fsPath],
          });

          const filePath = await adrDraftGenerator.saveAdr(adr);
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
        }
      } else {
        vscode.window.showInformationMessage('No ADR required for current changes');
      }
    }),

    vscode.commands.registerCommand('egce.showTemplates', async () => {
      const templates = await templateProvider.getAllTemplates();

      const items = templates.map((t) => ({
        label: t.name,
        description: `${t.language} - ${t.category}`,
        detail: t.description,
        template: t,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a template',
      });

      if (selected) {
        // Show template content in a new untitled document
        const doc = await vscode.workspace.openTextDocument({
          language: selected.template.language,
          content: `// Template: ${selected.template.name}\n// ${selected.template.description}\n\n${selected.template.template}`,
        });
        await vscode.window.showTextDocument(doc);
      }
    }),

    vscode.commands.registerCommand('egce.getPatternRecommendations', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const intent = await vscode.window.showInputBox({
        prompt: 'What are you trying to implement?',
        placeHolder: 'e.g., user authentication service',
      });

      if (!intent) return;

      const code = editor.document.getText();
      const recommendations = await patternValidator.getPatternRecommendations(code, intent);

      if (recommendations.length === 0) {
        vscode.window.showInformationMessage('No pattern recommendations found');
        return;
      }

      const items = recommendations.map((r) => ({
        label: r.pattern,
        description: `Relevance: ${Math.round(r.relevance * 100)}%`,
        detail: r.description,
      }));

      await vscode.window.showQuickPick(items, {
        placeHolder: 'Recommended patterns',
      });
    })
  );

  console.log('US-014: Agent Mode integration registered');

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
