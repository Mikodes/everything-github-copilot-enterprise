import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ContextFile {
  name: string;
  path: string;
  type: ContextFileType;
  exists: boolean;
}

export enum ContextFileType {
  ProjectContext = 'project-context',
  TeamContext = 'team-context',
  ModuleContext = 'module-context',
  DecisionRecord = 'decision-record',
  KnowledgeEntry = 'knowledge-entry',
  SessionContext = 'session-context',
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  filePath: string;
}

export interface Decision {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  filePath: string;
}

export class MemoryBankService {
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private getMemoryBankPath(): string {
    const configPath = vscode.workspace
      .getConfiguration('egce')
      .get<string>('memoryBankPath', '.memory-bank');
    return path.join(this.workspaceRoot || '', configPath);
  }

  async hasMemoryBank(): Promise<boolean> {
    if (!this.workspaceRoot) {
      return false;
    }

    try {
      const memoryBankPath = this.getMemoryBankPath();
      await fs.access(memoryBankPath);
      return true;
    } catch {
      return false;
    }
  }

  async getContextFiles(): Promise<ContextFile[]> {
    const memoryBankPath = this.getMemoryBankPath();
    const files: ContextFile[] = [];

    const contextTypes = [
      {
        name: 'project-context.md',
        type: ContextFileType.ProjectContext,
      },
      {
        name: 'team-context.md',
        type: ContextFileType.TeamContext,
      },
      {
        name: 'active-context.md',
        type: ContextFileType.SessionContext,
      },
    ];

    for (const { name, type } of contextTypes) {
      const filePath = path.join(memoryBankPath, name);
      let exists = false;

      try {
        await fs.access(filePath);
        exists = true;
      } catch {
        exists = false;
      }

      files.push({
        name,
        path: filePath,
        type,
        exists,
      });
    }

    // Add module contexts from modules directory
    try {
      const modulesPath = path.join(memoryBankPath, 'modules');
      const moduleFiles = await fs.readdir(modulesPath);

      for (const file of moduleFiles) {
        if (file.endsWith('.md')) {
          files.push({
            name: file,
            path: path.join(modulesPath, file),
            type: ContextFileType.ModuleContext,
            exists: true,
          });
        }
      }
    } catch {
      // Modules directory doesn't exist yet
    }

    // Add knowledge entries
    try {
      const knowledgePath = path.join(memoryBankPath, 'knowledge');
      const knowledgeFiles = await fs.readdir(knowledgePath);

      for (const file of knowledgeFiles) {
        if (file.endsWith('.md')) {
          files.push({
            name: file,
            path: path.join(knowledgePath, file),
            type: ContextFileType.KnowledgeEntry,
            exists: true,
          });
        }
      }
    } catch {
      // Knowledge directory doesn't exist yet
    }

    return files;
  }

  async getDecisions(): Promise<Decision[]> {
    const memoryBankPath = this.getMemoryBankPath();
    const decisionsPath = path.join(memoryBankPath, 'decisions');
    const decisions: Decision[] = [];

    try {
      const files = await fs.readdir(decisionsPath);

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(decisionsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');

          // Parse ADR metadata from frontmatter or content
          const decision = this.parseDecision(file, filePath, content);
          if (decision) {
            decisions.push(decision);
          }
        }
      }
    } catch {
      // Decisions directory doesn't exist yet
    }

    return decisions.sort((a, b) => b.date.localeCompare(a.date));
  }

  private parseDecision(
    filename: string,
    filePath: string,
    content: string
  ): Decision | null {
    // Extract ADR number and title from filename (e.g., "0001-use-typescript.md")
    const match = filename.match(/^(\d+)-(.+)\.md$/);
    if (!match) {
      return null;
    }

    const id = match[1];
    const titleFromFilename = match[2].replace(/-/g, ' ');

    // Try to extract status from content
    let status: Decision['status'] = 'proposed';
    const statusMatch = content.match(/##\s*Status\s*\n+(\w+)/i);
    if (statusMatch) {
      const statusText = statusMatch[1].toLowerCase();
      if (['accepted', 'proposed', 'deprecated', 'superseded'].includes(statusText)) {
        status = statusText as Decision['status'];
      }
    }

    // Try to extract date from content
    let date = new Date().toISOString().split('T')[0];
    const dateMatch = content.match(/##\s*Date\s*\n+(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      date = dateMatch[1];
    }

    // Try to extract title from content
    let title = titleFromFilename;
    const titleMatch = content.match(/^#\s+(?:ADR[-\s]*\d+[:\s]*)?(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    return {
      id,
      title,
      status,
      date,
      filePath,
    };
  }

  async getAgents(): Promise<Agent[]> {
    // Look for agents in the core/agents directory relative to workspace
    const agents: Agent[] = [];

    // Default agents from EGCE core
    const defaultAgents = [
      {
        id: 'architect',
        name: 'Architect',
        description: 'System design and architecture decisions',
      },
      {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Code review and quality guidance',
      },
      {
        id: 'security-auditor',
        name: 'Security Auditor',
        description: 'Security analysis and vulnerability detection',
      },
      {
        id: 'onboarding-guide',
        name: 'Onboarding Guide',
        description: 'Developer onboarding assistance',
      },
      {
        id: 'knowledge-curator',
        name: 'Knowledge Curator',
        description: 'Memory Bank maintenance and organization',
      },
      {
        id: 'tech-debt-tracker',
        name: 'Tech Debt Tracker',
        description: 'Technical debt identification and tracking',
      },
      {
        id: 'performance-analyst',
        name: 'Performance Analyst',
        description: 'Performance analysis and optimization',
      },
      {
        id: 'adr-writer',
        name: 'ADR Writer',
        description: 'Architecture decision record documentation',
      },
    ];

    // Check if local agent files exist
    const agentsPath = path.join(this.workspaceRoot || '', 'core', 'agents');

    for (const agent of defaultAgents) {
      const filePath = path.join(agentsPath, `${agent.id}.agent.md`);
      let exists = false;

      try {
        await fs.access(filePath);
        exists = true;
      } catch {
        exists = false;
      }

      agents.push({
        ...agent,
        filePath: exists ? filePath : '',
      });
    }

    return agents;
  }

  async initializeMemoryBank(): Promise<void> {
    const memoryBankPath = this.getMemoryBankPath();

    // Create directory structure
    const directories = [
      memoryBankPath,
      path.join(memoryBankPath, 'modules'),
      path.join(memoryBankPath, 'decisions'),
      path.join(memoryBankPath, 'knowledge'),
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create initial context files
    await this.createProjectContext();
    await this.createActiveContext();
  }

  private async createProjectContext(): Promise<void> {
    const memoryBankPath = this.getMemoryBankPath();
    const filePath = path.join(memoryBankPath, 'project-context.md');

    const workspaceName =
      vscode.workspace.workspaceFolders?.[0]?.name || 'My Project';
    const stack = vscode.workspace
      .getConfiguration('egce')
      .get<string>('defaultStack', 'generic');

    const content = `# Project Context: ${workspaceName}

## Overview

<!-- Brief description of the project -->

## Technology Stack

- **Framework**: ${stack}
- **Language**:
- **Build Tool**:
- **Database**:

## Architecture

<!-- High-level architecture description -->

## Key Decisions

<!-- Link to important ADRs -->

## Team

<!-- Team structure and responsibilities -->

## Getting Started

<!-- Quick start instructions for new developers -->
`;

    try {
      await fs.access(filePath);
      // File exists, don't overwrite
    } catch {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  private async createActiveContext(): Promise<void> {
    const memoryBankPath = this.getMemoryBankPath();
    const filePath = path.join(memoryBankPath, 'active-context.md');

    const content = `# Active Context

## Current Focus

<!-- What you're currently working on -->

## Recent Changes

<!-- Recent important changes to the codebase -->

## Open Questions

<!-- Questions that need to be resolved -->

## Session Notes

<!-- Notes from current development session -->
`;

    try {
      await fs.access(filePath);
      // File exists, don't overwrite
    } catch {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  async createDecision(title: string): Promise<string> {
    const memoryBankPath = this.getMemoryBankPath();
    const decisionsPath = path.join(memoryBankPath, 'decisions');

    // Ensure decisions directory exists
    await fs.mkdir(decisionsPath, { recursive: true });

    // Get next ADR number
    const existingDecisions = await this.getDecisions();
    const nextNumber = existingDecisions.length + 1;
    const paddedNumber = String(nextNumber).padStart(4, '0');

    // Create filename from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${paddedNumber}-${slug}.md`;
    const filePath = path.join(decisionsPath, filename);

    const today = new Date().toISOString().split('T')[0];

    const content = `# ADR-${paddedNumber}: ${title}

## Status

Proposed

## Date

${today}

## Context

<!-- What is the issue that we're seeing that is motivating this decision or change? -->

## Decision

<!-- What is the change that we're proposing and/or doing? -->

## Consequences

### Positive

<!-- What are the positive consequences of this decision? -->

### Negative

<!-- What are the negative consequences of this decision? -->

### Neutral

<!-- What are the neutral consequences of this decision? -->

## Alternatives Considered

<!-- What alternatives were considered? Why were they rejected? -->

## References

<!-- Links to related documents, discussions, or resources -->
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async validateFile(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];

    try {
      const content = await fs.readFile(uri.fsPath, 'utf-8');
      const lines = content.split('\n');

      // Check for required sections based on file type
      const filename = path.basename(uri.fsPath);

      if (filename === 'project-context.md') {
        const requiredSections = [
          '## Overview',
          '## Technology Stack',
          '## Architecture',
        ];
        for (const section of requiredSections) {
          if (!content.includes(section)) {
            diagnostics.push(
              new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                `Missing required section: ${section}`,
                vscode.DiagnosticSeverity.Warning
              )
            );
          }
        }
      }

      // Check for empty sections (just comments)
      const sectionRegex = /^##\s+.+$/gm;
      let match;
      while ((match = sectionRegex.exec(content)) !== null) {
        const sectionStart = match.index;
        const nextSectionMatch = sectionRegex.exec(content);
        const sectionEnd = nextSectionMatch
          ? nextSectionMatch.index
          : content.length;
        sectionRegex.lastIndex = match.index + 1; // Reset for next iteration

        const sectionContent = content.slice(sectionStart, sectionEnd);
        const contentWithoutComments = sectionContent
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/^##\s+.+$/m, '')
          .trim();

        if (!contentWithoutComments) {
          const lineNumber = content.slice(0, sectionStart).split('\n').length - 1;
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(lineNumber, 0, lineNumber, lines[lineNumber]?.length || 0),
              `Section appears to be empty or contains only placeholder comments`,
              vscode.DiagnosticSeverity.Information
            )
          );
        }
      }
    } catch (error) {
      console.error('Error validating file:', error);
    }

    return diagnostics;
  }

  async updateContext(
    contextType: ContextFileType,
    content: string
  ): Promise<void> {
    const memoryBankPath = this.getMemoryBankPath();
    let filePath: string;

    switch (contextType) {
      case ContextFileType.ProjectContext:
        filePath = path.join(memoryBankPath, 'project-context.md');
        break;
      case ContextFileType.TeamContext:
        filePath = path.join(memoryBankPath, 'team-context.md');
        break;
      case ContextFileType.SessionContext:
        filePath = path.join(memoryBankPath, 'active-context.md');
        break;
      default:
        throw new Error(`Cannot update context type: ${contextType}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }
}
