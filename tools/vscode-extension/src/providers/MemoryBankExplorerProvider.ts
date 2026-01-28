import * as vscode from 'vscode';
import * as path from 'path';
import {
  MemoryBankService,
  ContextFile,
  ContextFileType,
} from '../services/MemoryBankService';

export class MemoryBankItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextFile?: ContextFile,
    public readonly itemType?: 'category' | 'file'
  ) {
    super(label, collapsibleState);

    if (contextFile) {
      this.resourceUri = vscode.Uri.file(contextFile.path);
      this.contextValue = 'contextFile';
      this.tooltip = contextFile.path;

      if (contextFile.exists) {
        this.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(contextFile.path)],
        };
        this.iconPath = this.getIconForType(contextFile.type);
      } else {
        this.iconPath = new vscode.ThemeIcon(
          'file',
          new vscode.ThemeColor('disabledForeground')
        );
        this.description = '(not created)';
        this.contextValue = 'contextFileMissing';
      }
    } else if (itemType === 'category') {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'category';
    }
  }

  private getIconForType(type: ContextFileType): vscode.ThemeIcon {
    switch (type) {
      case ContextFileType.ProjectContext:
        return new vscode.ThemeIcon('project');
      case ContextFileType.TeamContext:
        return new vscode.ThemeIcon('organization');
      case ContextFileType.ModuleContext:
        return new vscode.ThemeIcon('package');
      case ContextFileType.SessionContext:
        return new vscode.ThemeIcon('clock');
      case ContextFileType.KnowledgeEntry:
        return new vscode.ThemeIcon('book');
      case ContextFileType.DecisionRecord:
        return new vscode.ThemeIcon('lightbulb');
      default:
        return new vscode.ThemeIcon('file');
    }
  }
}

export class MemoryBankExplorerProvider
  implements vscode.TreeDataProvider<MemoryBankItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    MemoryBankItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private memoryBankService: MemoryBankService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryBankItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MemoryBankItem): Promise<MemoryBankItem[]> {
    const hasMemoryBank = await this.memoryBankService.hasMemoryBank();

    if (!hasMemoryBank) {
      return [];
    }

    if (!element) {
      // Root level - show categories
      return [
        new MemoryBankItem(
          'Core Context',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          'category'
        ),
        new MemoryBankItem(
          'Modules',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'category'
        ),
        new MemoryBankItem(
          'Knowledge Base',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'category'
        ),
      ];
    }

    // Get context files
    const contextFiles = await this.memoryBankService.getContextFiles();

    switch (element.label) {
      case 'Core Context':
        return contextFiles
          .filter(
            (f) =>
              f.type === ContextFileType.ProjectContext ||
              f.type === ContextFileType.TeamContext ||
              f.type === ContextFileType.SessionContext
          )
          .map(
            (f) =>
              new MemoryBankItem(
                f.name,
                vscode.TreeItemCollapsibleState.None,
                f,
                'file'
              )
          );

      case 'Modules':
        return contextFiles
          .filter((f) => f.type === ContextFileType.ModuleContext)
          .map(
            (f) =>
              new MemoryBankItem(
                f.name,
                vscode.TreeItemCollapsibleState.None,
                f,
                'file'
              )
          );

      case 'Knowledge Base':
        return contextFiles
          .filter((f) => f.type === ContextFileType.KnowledgeEntry)
          .map(
            (f) =>
              new MemoryBankItem(
                f.name,
                vscode.TreeItemCollapsibleState.None,
                f,
                'file'
              )
          );

      default:
        return [];
    }
  }
}
