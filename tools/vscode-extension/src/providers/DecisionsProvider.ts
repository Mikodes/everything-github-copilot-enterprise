import * as vscode from 'vscode';
import { MemoryBankService, Decision } from '../services/MemoryBankService';

export class DecisionItem extends vscode.TreeItem {
  constructor(public readonly decision: Decision) {
    super(
      `ADR-${decision.id}: ${decision.title}`,
      vscode.TreeItemCollapsibleState.None
    );

    this.tooltip = `${decision.title}\nStatus: ${decision.status}\nDate: ${decision.date}`;
    this.description = decision.status;
    this.contextValue = 'decision';

    // Set icon based on status
    this.iconPath = this.getIconForStatus(decision.status);

    // Open file on click
    this.command = {
      command: 'vscode.open',
      title: 'Open Decision Record',
      arguments: [vscode.Uri.file(decision.filePath)],
    };
  }

  private getIconForStatus(
    status: Decision['status']
  ): vscode.ThemeIcon {
    const iconMap: Record<Decision['status'], { icon: string; color?: string }> = {
      proposed: { icon: 'question', color: 'charts.yellow' },
      accepted: { icon: 'check', color: 'charts.green' },
      deprecated: { icon: 'warning', color: 'charts.orange' },
      superseded: { icon: 'arrow-swap', color: 'charts.blue' },
    };

    const config = iconMap[status];
    return new vscode.ThemeIcon(
      config.icon,
      config.color ? new vscode.ThemeColor(config.color) : undefined
    );
  }
}

export class DecisionsProvider
  implements vscode.TreeDataProvider<DecisionItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    DecisionItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private memoryBankService: MemoryBankService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DecisionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DecisionItem): Promise<DecisionItem[]> {
    if (element) {
      return [];
    }

    const hasMemoryBank = await this.memoryBankService.hasMemoryBank();
    if (!hasMemoryBank) {
      return [];
    }

    const decisions = await this.memoryBankService.getDecisions();
    return decisions.map((decision) => new DecisionItem(decision));
  }
}
