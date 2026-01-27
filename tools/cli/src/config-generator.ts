/**
 * Config Generator Library
 *
 * Generates GitHub Copilot configuration files from Memory Bank context
 * and templates. Supports different tech stacks and project types.
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// Types
export interface GeneratorConfig {
  templatesPath: string;
  outputPath: string;
}

export interface ProjectConfig {
  name: string;
  description: string;
  stack: 'java-spring' | 'dotnet' | 'typescript' | 'generic';
  stackVersion?: string;
  features: ProjectFeatures;
}

export interface ProjectFeatures {
  memoryBank: boolean;
  agents: boolean;
  instructions: boolean;
  prompts: boolean;
  chatModes: boolean;
  mcp: boolean;
}

export interface GenerationResult {
  success: boolean;
  filesCreated: string[];
  filesUpdated: string[];
  errors: GenerationError[];
  warnings: string[];
}

export interface GenerationError {
  file: string;
  message: string;
}

export interface StackConfig {
  name: string;
  displayName: string;
  versions: string[];
  agents: string[];
  instructions: string[];
  patterns: string[];
}

/**
 * Config Generator
 *
 * Generates Copilot configurations based on project settings and templates.
 */
export class ConfigGenerator {
  private config: GeneratorConfig;
  private stacks: Map<string, StackConfig>;

  constructor(config?: Partial<GeneratorConfig>) {
    this.config = {
      templatesPath: config?.templatesPath || path.join(__dirname, '../../core'),
      outputPath: config?.outputPath || process.cwd(),
    };

    // Initialize stack configurations
    this.stacks = new Map([
      ['java-spring', {
        name: 'java-spring',
        displayName: 'Java/Spring Boot',
        versions: ['3.2', '3.3', '4.0'],
        agents: ['spring-architect', 'jpa-specialist', 'spring-security-expert'],
        instructions: ['java-21-features', 'spring-boot-3', 'spring-data-jpa'],
        patterns: ['hexagonal-architecture', 'cqrs'],
      }],
      ['dotnet', {
        name: 'dotnet',
        displayName: '.NET',
        versions: ['8', '9'],
        agents: ['dotnet-architect', 'ef-core-specialist', 'aspnet-security-expert'],
        instructions: ['csharp-12-features', 'dotnet-8-lts', 'ef-core-8'],
        patterns: ['clean-architecture', 'mediatr-cqrs'],
      }],
      ['typescript', {
        name: 'typescript',
        displayName: 'TypeScript/Node.js',
        versions: ['5.3', '5.4', '5.5'],
        agents: [],
        instructions: [],
        patterns: [],
      }],
      ['generic', {
        name: 'generic',
        displayName: 'Generic',
        versions: [],
        agents: [],
        instructions: [],
        patterns: [],
      }],
    ]);
  }

  /**
   * Initialize a new project with Copilot configurations
   */
  async initProject(projectConfig: ProjectConfig): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: true,
      filesCreated: [],
      filesUpdated: [],
      errors: [],
      warnings: [],
    };

    try {
      // Create .github directory structure
      await this.createGitHubStructure(projectConfig, result);

      // Create Memory Bank if enabled
      if (projectConfig.features.memoryBank) {
        await this.createMemoryBank(projectConfig, result);
      }

      // Create agents if enabled
      if (projectConfig.features.agents) {
        await this.createAgents(projectConfig, result);
      }

      // Create instructions if enabled
      if (projectConfig.features.instructions) {
        await this.createInstructions(projectConfig, result);
      }

      // Create prompts if enabled
      if (projectConfig.features.prompts) {
        await this.createPrompts(projectConfig, result);
      }

      // Create MCP config if enabled
      if (projectConfig.features.mcp) {
        await this.createMCPConfig(projectConfig, result);
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        file: 'general',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Add stack-specific configurations to existing project
   */
  async addStack(stackName: string, version?: string): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: true,
      filesCreated: [],
      filesUpdated: [],
      errors: [],
      warnings: [],
    };

    const stack = this.stacks.get(stackName);
    if (!stack) {
      result.success = false;
      result.errors.push({
        file: '',
        message: `Unknown stack: ${stackName}. Available: ${Array.from(this.stacks.keys()).join(', ')}`,
      });
      return result;
    }

    // Validate version
    if (version && !stack.versions.includes(version)) {
      result.warnings.push(`Version ${version} not in recommended versions: ${stack.versions.join(', ')}`);
    }

    // Copy stack-specific agents
    for (const agent of stack.agents) {
      await this.copyAgent(agent, result);
    }

    // Copy stack-specific instructions
    for (const instruction of stack.instructions) {
      await this.copyInstruction(instruction, result);
    }

    return result;
  }

  /**
   * Generate copilot-instructions.md from Memory Bank
   */
  async generateCopilotInstructions(): Promise<string> {
    const sections: string[] = [];

    // Add header
    sections.push('# Copilot Instructions\n');
    sections.push('> Auto-generated from Memory Bank. Do not edit directly.\n');

    // Read project context
    const projectContextPath = path.join(this.config.outputPath, '.memory-bank/project/context.md');
    if (await fs.pathExists(projectContextPath)) {
      sections.push('## Project Context\n');
      const content = await fs.readFile(projectContextPath, 'utf-8');
      sections.push(this.extractSummary(content));
    }

    // Read team context
    const teamContextPath = path.join(this.config.outputPath, '.memory-bank/team/context.md');
    if (await fs.pathExists(teamContextPath)) {
      sections.push('\n## Team Conventions\n');
      const content = await fs.readFile(teamContextPath, 'utf-8');
      sections.push(this.extractSummary(content));
    }

    // Include core standards
    sections.push('\n## Standards\n');
    sections.push('Follow the instructions in `.github/copilot-instructions/` directory.\n');

    return sections.join('\n');
  }

  /**
   * Get available stacks
   */
  getAvailableStacks(): StackConfig[] {
    return Array.from(this.stacks.values());
  }

  /**
   * Validate project configuration
   */
  validateProjectConfig(config: Partial<ProjectConfig>): string[] {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Project name is required');
    }

    if (config.stack && !this.stacks.has(config.stack)) {
      errors.push(`Invalid stack: ${config.stack}`);
    }

    return errors;
  }

  // Private helper methods

  private async createGitHubStructure(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const dirs = [
      '.github',
      '.github/copilot-instructions',
      '.github/prompts',
    ];

    for (const dir of dirs) {
      const dirPath = path.join(this.config.outputPath, dir);
      await fs.ensureDir(dirPath);
    }

    // Create copilot-instructions.md
    const instructionsContent = await this.generateCopilotInstructions();
    const instructionsPath = path.join(this.config.outputPath, '.github/copilot-instructions.md');
    await fs.writeFile(instructionsPath, instructionsContent);
    result.filesCreated.push('.github/copilot-instructions.md');
  }

  private async createMemoryBank(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const mbPath = path.join(this.config.outputPath, '.memory-bank');

    const dirs = [
      'project',
      'team',
      'modules',
      'decisions',
      'knowledge',
    ];

    for (const dir of dirs) {
      await fs.ensureDir(path.join(mbPath, dir));
    }

    // Create project context with project info
    const projectContext = `---
name: ${config.name}
description: ${config.description}
version: "0.1.0"
lastUpdated: ${new Date().toISOString().split('T')[0]}
status: development
---

# Project Context: ${config.name}

## Overview

${config.description}

## Technology Stack

- **Stack**: ${this.stacks.get(config.stack)?.displayName || config.stack}
${config.stackVersion ? `- **Version**: ${config.stackVersion}` : ''}

## Getting Started

See the project README for setup instructions.
`;

    await fs.writeFile(path.join(mbPath, 'project/context.md'), projectContext);
    result.filesCreated.push('.memory-bank/project/context.md');

    // Create README
    const readme = `# Memory Bank

This directory contains the team's shared knowledge for GitHub Copilot.

## Structure

- \`project/\` - Project context
- \`team/\` - Team conventions
- \`modules/\` - Module-specific contexts
- \`decisions/\` - Architecture Decision Records
- \`knowledge/\` - Patterns and best practices

## Commands

\`\`\`bash
egce memory validate      # Validate Memory Bank
egce memory add-module    # Add new module
egce memory add-decision  # Add new ADR
\`\`\`
`;

    await fs.writeFile(path.join(mbPath, 'README.md'), readme);
    result.filesCreated.push('.memory-bank/README.md');
  }

  private async createAgents(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const agentsDir = path.join(this.config.outputPath, '.github/agents');
    await fs.ensureDir(agentsDir);

    // Copy core agents
    const coreAgents = ['architect', 'code-reviewer', 'onboarding-guide'];
    for (const agent of coreAgents) {
      await this.copyAgent(agent, result);
    }

    // Copy stack-specific agents
    const stack = this.stacks.get(config.stack);
    if (stack) {
      for (const agent of stack.agents) {
        await this.copyAgent(agent, result);
      }
    }
  }

  private async copyAgent(agentName: string, result: GenerationResult): Promise<void> {
    const sourcePath = path.join(this.config.templatesPath, 'agents', `${agentName}.agent.md`);
    const destPath = path.join(this.config.outputPath, '.github/agents', `${agentName}.agent.md`);

    if (await fs.pathExists(sourcePath)) {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(sourcePath, destPath);
      result.filesCreated.push(`.github/agents/${agentName}.agent.md`);
    } else {
      result.warnings.push(`Agent template not found: ${agentName}`);
    }
  }

  private async createInstructions(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const instructionsDir = path.join(this.config.outputPath, '.github/copilot-instructions');
    await fs.ensureDir(instructionsDir);

    // Copy core instructions
    const coreInstructions = ['enterprise-standards', 'git-workflow', 'testing-standards', 'security-baseline'];
    for (const instruction of coreInstructions) {
      await this.copyInstruction(instruction, result);
    }

    // Copy stack-specific instructions
    const stack = this.stacks.get(config.stack);
    if (stack) {
      for (const instruction of stack.instructions) {
        await this.copyInstruction(instruction, result);
      }
    }
  }

  private async copyInstruction(instructionName: string, result: GenerationResult): Promise<void> {
    const sourcePath = path.join(this.config.templatesPath, 'instructions', `${instructionName}.instructions.md`);
    const destPath = path.join(this.config.outputPath, '.github/copilot-instructions', `${instructionName}.md`);

    if (await fs.pathExists(sourcePath)) {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(sourcePath, destPath);
      result.filesCreated.push(`.github/copilot-instructions/${instructionName}.md`);
    } else {
      result.warnings.push(`Instruction template not found: ${instructionName}`);
    }
  }

  private async createPrompts(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const promptsDir = path.join(this.config.outputPath, '.github/prompts');
    await fs.ensureDir(promptsDir);

    // Copy core prompts
    const corePrompts = ['analyze-impact', 'review-pr', 'document-decision', 'estimate-task'];
    for (const prompt of corePrompts) {
      const sourcePath = path.join(this.config.templatesPath, 'prompts', `${prompt}.prompt.md`);
      const destPath = path.join(promptsDir, `${prompt}.md`);

      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        result.filesCreated.push(`.github/prompts/${prompt}.md`);
      }
    }
  }

  private async createMCPConfig(config: ProjectConfig, result: GenerationResult): Promise<void> {
    const mcpDir = path.join(this.config.outputPath, '.github/mcp');
    await fs.ensureDir(mcpDir);

    // Create basic MCP configuration
    const mcpConfig = {
      version: '1.0',
      servers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@anthropic-ai/mcp-server-filesystem', '.'],
        },
      ],
    };

    const configPath = path.join(mcpDir, 'config.json');
    await fs.writeJson(configPath, mcpConfig, { spaces: 2 });
    result.filesCreated.push('.github/mcp/config.json');
  }

  private extractSummary(markdownContent: string): string {
    // Remove frontmatter
    const withoutFrontmatter = markdownContent.replace(/^---[\s\S]*?---\n/, '');

    // Get first few paragraphs
    const paragraphs = withoutFrontmatter.split('\n\n');
    const summary = paragraphs.slice(0, 3).join('\n\n');

    return summary.substring(0, 500) + (summary.length > 500 ? '...' : '');
  }
}

// Export singleton instance
export const configGenerator = new ConfigGenerator();
