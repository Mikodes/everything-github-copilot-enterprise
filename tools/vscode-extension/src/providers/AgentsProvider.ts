import * as vscode from 'vscode';
import { MemoryBankService, Agent } from '../services/MemoryBankService';

export class AgentItem extends vscode.TreeItem {
  constructor(public readonly agent: Agent) {
    super(agent.name, vscode.TreeItemCollapsibleState.None);

    this.tooltip = agent.description;
    this.description = agent.description;
    this.contextValue = 'agent';

    // Set icon based on agent type
    this.iconPath = this.getIconForAgent(agent.id);

    // If agent file exists, allow opening it
    if (agent.filePath) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Agent Definition',
        arguments: [vscode.Uri.file(agent.filePath)],
      };
    }
  }

  private getIconForAgent(agentId: string): vscode.ThemeIcon {
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

    return new vscode.ThemeIcon(iconMap[agentId] || 'person');
  }
}

export class AgentsProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    AgentItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private memoryBankService: MemoryBankService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentItem): Promise<AgentItem[]> {
    if (element) {
      return [];
    }

    const agents = await this.memoryBankService.getAgents();
    return agents.map((agent) => new AgentItem(agent));
  }
}
