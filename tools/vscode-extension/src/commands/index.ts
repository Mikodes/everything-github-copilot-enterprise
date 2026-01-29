import * as vscode from 'vscode';
import { MemoryBankService } from '../services/MemoryBankService';
import { MemoryBankExplorerProvider } from '../providers/MemoryBankExplorerProvider';
import { AgentsProvider } from '../providers/AgentsProvider';
import { DecisionsProvider } from '../providers/DecisionsProvider';
import { CollaborationService, getCollaborationService } from '../services/CollaborationService';
import { CursorDecorationProvider } from '../providers/CursorDecorationProvider';
import { PresenceProvider } from '../providers/PresenceProvider';
import { CollaborationChatProvider, CollaborationChatPanel, showQuickChatInput } from '../providers/CollaborationChatProvider';
import { Collaborator } from '../models/collaboration';

export function registerCommands(
  context: vscode.ExtensionContext,
  memoryBankService: MemoryBankService,
  memoryBankExplorerProvider: MemoryBankExplorerProvider,
  agentsProvider: AgentsProvider,
  decisionsProvider: DecisionsProvider,
  collaborationService?: CollaborationService,
  cursorProvider?: CursorDecorationProvider,
  presenceProvider?: PresenceProvider,
  chatProvider?: CollaborationChatProvider
): void {
  // Init Project Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.initProject', async () => {
      const hasMemoryBank = await memoryBankService.hasMemoryBank();

      if (hasMemoryBank) {
        const overwrite = await vscode.window.showWarningMessage(
          'Memory Bank already exists. Do you want to reinitialize?',
          'Yes',
          'No'
        );

        if (overwrite !== 'Yes') {
          return;
        }
      }

      try {
        await memoryBankService.initializeMemoryBank();
        memoryBankExplorerProvider.refresh();
        decisionsProvider.refresh();

        vscode.window.showInformationMessage(
          'Memory Bank initialized successfully!'
        );

        // Open the project context file
        const contextFiles = await memoryBankService.getContextFiles();
        const projectContext = contextFiles.find(
          (f) => f.name === 'project-context.md'
        );
        if (projectContext) {
          const doc = await vscode.workspace.openTextDocument(
            projectContext.path
          );
          await vscode.window.showTextDocument(doc);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to initialize Memory Bank: ${error}`
        );
      }
    })
  );

  // Update Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.updateContext', async () => {
      const contextTypes = [
        { label: 'Project Context', description: 'Update project-level context' },
        { label: 'Team Context', description: 'Update team structure and roles' },
        { label: 'Active Context', description: 'Update current session context' },
      ];

      const selected = await vscode.window.showQuickPick(contextTypes, {
        placeHolder: 'Select context type to update',
      });

      if (!selected) {
        return;
      }

      const contextFiles = await memoryBankService.getContextFiles();
      let targetFile;

      switch (selected.label) {
        case 'Project Context':
          targetFile = contextFiles.find((f) => f.name === 'project-context.md');
          break;
        case 'Team Context':
          targetFile = contextFiles.find((f) => f.name === 'team-context.md');
          break;
        case 'Active Context':
          targetFile = contextFiles.find((f) => f.name === 'active-context.md');
          break;
      }

      if (targetFile?.exists) {
        const doc = await vscode.workspace.openTextDocument(targetFile.path);
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage(
          'Context file not found. Initialize Memory Bank first.'
        );
      }
    })
  );

  // Add Decision Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.addDecision', async () => {
      const hasMemoryBank = await memoryBankService.hasMemoryBank();

      if (!hasMemoryBank) {
        const init = await vscode.window.showWarningMessage(
          'Memory Bank not found. Initialize it first?',
          'Initialize',
          'Cancel'
        );

        if (init === 'Initialize') {
          await vscode.commands.executeCommand('egce.initProject');
        }
        return;
      }

      const title = await vscode.window.showInputBox({
        prompt: 'Enter the title for the Architecture Decision Record',
        placeHolder: 'e.g., Use PostgreSQL for data persistence',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Title is required';
          }
          if (value.length > 100) {
            return 'Title must be less than 100 characters';
          }
          return null;
        },
      });

      if (!title) {
        return;
      }

      try {
        const filePath = await memoryBankService.createDecision(title);
        decisionsProvider.refresh();

        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(
          `Created ADR: ${title}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ADR: ${error}`);
      }
    })
  );

  // Select Agent Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.selectAgent', async () => {
      const agents = await memoryBankService.getAgents();

      const agentItems = agents.map((agent) => ({
        label: `$(${getAgentIcon(agent.id)}) ${agent.name}`,
        description: agent.description,
        agent,
      }));

      const selected = await vscode.window.showQuickPick(agentItems, {
        placeHolder: 'Select an agent to use',
        matchOnDescription: true,
      });

      if (!selected) {
        return;
      }

      // Show agent details and copy instruction to clipboard
      const actions = ['Open Agent Definition', 'Copy Agent Prompt'];

      if (selected.agent.filePath) {
        const action = await vscode.window.showQuickPick(actions, {
          placeHolder: `Selected: ${selected.agent.name}`,
        });

        if (action === 'Open Agent Definition') {
          const doc = await vscode.workspace.openTextDocument(
            selected.agent.filePath
          );
          await vscode.window.showTextDocument(doc);
        } else if (action === 'Copy Agent Prompt') {
          const prompt = `Use the ${selected.agent.name} agent: ${selected.agent.description}`;
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage(
            `Copied ${selected.agent.name} prompt to clipboard`
          );
        }
      } else {
        vscode.window.showInformationMessage(
          `Selected agent: ${selected.agent.name}\n${selected.agent.description}`
        );
      }
    })
  );

  // Refresh Memory Bank Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.refreshMemoryBank', () => {
      memoryBankExplorerProvider.refresh();
      agentsProvider.refresh();
      decisionsProvider.refresh();
      vscode.window.showInformationMessage('Memory Bank refreshed');
    })
  );

  // Open Context File Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'egce.openContextFile',
      async (item: { contextFile?: { path: string } }) => {
        if (item?.contextFile?.path) {
          const doc = await vscode.workspace.openTextDocument(
            item.contextFile.path
          );
          await vscode.window.showTextDocument(doc);
        }
      }
    )
  );

  // Validate Memory Bank Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.validateMemoryBank', async () => {
      const hasMemoryBank = await memoryBankService.hasMemoryBank();

      if (!hasMemoryBank) {
        vscode.window.showWarningMessage('No Memory Bank found to validate');
        return;
      }

      const contextFiles = await memoryBankService.getContextFiles();
      let totalIssues = 0;

      const diagnosticCollection =
        vscode.languages.createDiagnosticCollection('egce');

      for (const file of contextFiles) {
        if (file.exists) {
          const uri = vscode.Uri.file(file.path);
          const diagnostics = await memoryBankService.validateFile(uri);
          diagnosticCollection.set(uri, diagnostics);
          totalIssues += diagnostics.length;
        }
      }

      if (totalIssues === 0) {
        vscode.window.showInformationMessage(
          'Memory Bank validation passed! No issues found.'
        );
      } else {
        vscode.window.showWarningMessage(
          `Memory Bank validation found ${totalIssues} issue(s). Check the Problems panel.`
        );
      }
    })
  );

  // Create Context File Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.createContextFile', async () => {
      const hasMemoryBank = await memoryBankService.hasMemoryBank();

      if (!hasMemoryBank) {
        const init = await vscode.window.showWarningMessage(
          'Memory Bank not found. Initialize it first?',
          'Initialize',
          'Cancel'
        );

        if (init === 'Initialize') {
          await vscode.commands.executeCommand('egce.initProject');
        }
        return;
      }

      const fileTypes = [
        {
          label: 'Module Context',
          description: 'Define a bounded context or module',
        },
        {
          label: 'Knowledge Entry',
          description: 'Add a knowledge base entry',
        },
        {
          label: 'Team Context',
          description: 'Define team structure and roles',
        },
      ];

      const selected = await vscode.window.showQuickPick(fileTypes, {
        placeHolder: 'Select the type of context file to create',
      });

      if (!selected) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: `Enter the name for the ${selected.label}`,
        placeHolder:
          selected.label === 'Module Context'
            ? 'e.g., user-management'
            : 'e.g., authentication-patterns',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Name is required';
          }
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Name must be lowercase with hyphens only';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      // Create the file based on type
      const memoryBankPath = vscode.workspace
        .getConfiguration('egce')
        .get<string>('memoryBankPath', '.memory-bank');
      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

      let filePath: string;
      let content: string;

      const fs = await import('fs/promises');
      const path = await import('path');

      switch (selected.label) {
        case 'Module Context':
          filePath = path.join(
            workspaceRoot,
            memoryBankPath,
            'modules',
            `${name}.md`
          );
          content = `# Module: ${name}

## Overview

<!-- Brief description of this module/bounded context -->

## Responsibilities

<!-- What this module is responsible for -->

## Dependencies

<!-- Internal and external dependencies -->

## API

<!-- Public interfaces exposed by this module -->

## Data Model

<!-- Key entities and their relationships -->

## Key Decisions

<!-- Important architectural decisions for this module -->
`;
          break;

        case 'Knowledge Entry':
          filePath = path.join(
            workspaceRoot,
            memoryBankPath,
            'knowledge',
            `${name}.md`
          );
          content = `# ${name
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}

## Summary

<!-- Brief summary of this knowledge entry -->

## Details

<!-- Detailed explanation -->

## Examples

<!-- Code examples or use cases -->

## References

<!-- Links to related documentation or resources -->
`;
          break;

        case 'Team Context':
          filePath = path.join(
            workspaceRoot,
            memoryBankPath,
            'team-context.md'
          );
          content = `# Team Context

## Team Structure

<!-- Team organization and hierarchy -->

## Roles and Responsibilities

<!-- Key roles and what they're responsible for -->

## Communication

<!-- Communication channels and practices -->

## Processes

<!-- Development processes and workflows -->

## Contacts

<!-- Key contacts and their areas of expertise -->
`;
          break;

        default:
          return;
      }

      try {
        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');

        memoryBankExplorerProvider.refresh();

        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Created: ${name}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create file: ${error}`);
      }
    })
  );

  // ============================================
  // US-012: Real-time Collaboration Commands
  // ============================================

  // Start Collaboration Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.startCollaboration', async () => {
      const service = collaborationService ?? getCollaborationService();
      try {
        await service.connect();
        vscode.window.showInformationMessage('Connected to collaboration server');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
      }
    })
  );

  // Stop Collaboration Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.stopCollaboration', () => {
      const service = collaborationService ?? getCollaborationService();
      service.disconnect();
      vscode.window.showInformationMessage('Disconnected from collaboration server');
    })
  );

  // Show Collaborators Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.showCollaborators', async () => {
      const service = collaborationService ?? getCollaborationService();
      const collaborators = service.getCollaborators();

      if (collaborators.length === 0) {
        vscode.window.showInformationMessage('No collaborators online');
        return;
      }

      const items = collaborators.map((c) => ({
        label: `$(person) ${c.user.name}`,
        description: c.status,
        detail: c.currentFile ? `Viewing: ${c.currentFile.split('/').pop()}` : 'No file open',
        collaborator: c,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `${collaborators.length} collaborator(s) online`,
      });

      if (selected?.collaborator.currentFile && selected.collaborator.cursorPosition) {
        // Go to their cursor
        await vscode.commands.executeCommand(
          'egce.goToCollaboratorCursor',
          selected.collaborator
        );
      }
    })
  );

  // Go to Collaborator Cursor Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'egce.goToCollaboratorCursor',
      async (collaborator: Collaborator) => {
        if (!collaborator.currentFile) {
          vscode.window.showWarningMessage('Collaborator has no file open');
          return;
        }

        try {
          const doc = await vscode.workspace.openTextDocument(collaborator.currentFile);
          const editor = await vscode.window.showTextDocument(doc);

          if (collaborator.cursorPosition) {
            const position = new vscode.Position(
              collaborator.cursorPosition.line,
              collaborator.cursorPosition.column
            );
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
              new vscode.Range(position, position),
              vscode.TextEditorRevealType.InCenter
            );
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to navigate: ${error}`);
        }
      }
    )
  );

  // Toggle Cursor Visibility Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.toggleCollaboratorCursors', () => {
      if (cursorProvider) {
        cursorProvider.toggle();
        const enabled = cursorProvider.isEnabled();
        vscode.window.showInformationMessage(
          `Collaborator cursors ${enabled ? 'enabled' : 'disabled'}`
        );
      }
    })
  );

  // Refresh Collaborators Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.refreshCollaborators', () => {
      if (presenceProvider) {
        presenceProvider.refresh();
      }
      if (chatProvider) {
        chatProvider.refresh();
      }
    })
  );

  // Open Chat Panel Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.openChatPanel', () => {
      CollaborationChatPanel.createOrShow(context.extensionUri);
    })
  );

  // Quick Chat Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.quickChat', async () => {
      await showQuickChatInput();
    })
  );

  // Send Chat Message Command (for programmatic use)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'egce.sendChatMessage',
      async (message: string, contextFile?: string, contextLine?: number) => {
        const service = collaborationService ?? getCollaborationService();
        service.sendChatMessage(message, contextFile, contextLine);
      }
    )
  );

  // Toggle Collaboration Command
  context.subscriptions.push(
    vscode.commands.registerCommand('egce.toggleCollaboration', async () => {
      const service = collaborationService ?? getCollaborationService();
      const state = service.getConnectionState();

      if (state === 'connected') {
        service.disconnect();
        vscode.window.showInformationMessage('Collaboration disabled');
      } else {
        try {
          await service.connect();
          vscode.window.showInformationMessage('Collaboration enabled');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
      }
    })
  );
}

function getAgentIcon(agentId: string): string {
  const iconMap: Record<string, string> = {
    architect: 'symbol-structure',
    'code-reviewer': 'checklist',
    'security-auditor': 'shield',
    'onboarding-guide': 'mortar-board',
    'knowledge-curator': 'library',
    'tech-debt-tracker': 'warning',
    'performance-analyst': 'dashboard',
    'adr-writer': 'note',
  };

  return iconMap[agentId] || 'person';
}
