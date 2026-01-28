/**
 * Migrate Command
 *
 * Migrates configurations from Claude Code to EGCE format.
 * Supports migration of CLAUDE.md, agents, skills, and commands.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import yaml from 'js-yaml';

import {
  ClaudeMdParser,
  AgentsParser,
  SkillsParser,
  CommandsParser,
  MemoryBankConversion,
  EGCEAgent,
  EGCEConfig,
  EGCEPrompt,
} from '../parsers/index.js';

// Types
export interface MigrateOptions {
  from?: string;
  path?: string;
  dryRun?: boolean;
  output?: string;
  force?: boolean;
  interactive?: boolean;
}

export interface MigrationResult {
  success: boolean;
  source: string;
  memoryBank: MemoryBankResult | null;
  agents: AgentsResult | null;
  configs: ConfigsResult | null;
  prompts: PromptsResult | null;
  warnings: string[];
  errors: string[];
}

export interface MemoryBankResult {
  projectContext: boolean;
  teamContext: boolean;
  knowledgeEntries: number;
  decisions: number;
  instructions: number;
}

export interface AgentsResult {
  total: number;
  converted: number;
  files: string[];
}

export interface ConfigsResult {
  total: number;
  converted: number;
  files: string[];
}

export interface PromptsResult {
  total: number;
  converted: number;
  files: string[];
}

export interface ClaudeCodeStructure {
  hasClaudeMd: boolean;
  claudeMdPath: string | null;
  hasAgentsDir: boolean;
  agentsDirPath: string | null;
  hasSkillsDir: boolean;
  skillsDirPath: string | null;
  hasCommandsDir: boolean;
  commandsDirPath: string | null;
}

/**
 * Main migrate command handler
 */
export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const spinner = ora();

  console.log(chalk.cyan('\n🔄 EGCE Migration Tool\n'));
  console.log(chalk.gray('Migrating from Claude Code configuration to EGCE format.\n'));

  try {
    // Determine source
    const source = options.from || 'claude-code';
    const sourcePath = options.path || process.cwd();
    const outputPath = options.output || process.cwd();
    const dryRun = options.dryRun || false;

    if (source !== 'claude-code') {
      console.log(chalk.red(`❌ Unknown source format: ${source}`));
      console.log(chalk.gray('Currently supported: claude-code'));
      return;
    }

    // Detect Claude Code structure
    spinner.start('Detecting Claude Code configuration...');
    const structure = await detectClaudeCodeStructure(sourcePath);
    spinner.succeed('Claude Code configuration detected');

    // Show what was found
    console.log(chalk.cyan('\n📁 Detected configuration:'));
    console.log(`   CLAUDE.md:  ${structure.hasClaudeMd ? chalk.green('✓ Found') : chalk.gray('Not found')}`);
    console.log(`   agents/:    ${structure.hasAgentsDir ? chalk.green('✓ Found') : chalk.gray('Not found')}`);
    console.log(`   skills/:    ${structure.hasSkillsDir ? chalk.green('✓ Found') : chalk.gray('Not found')}`);
    console.log(`   commands/:  ${structure.hasCommandsDir ? chalk.green('✓ Found') : chalk.gray('Not found')}`);

    if (!structure.hasClaudeMd && !structure.hasAgentsDir && !structure.hasSkillsDir && !structure.hasCommandsDir) {
      console.log(chalk.yellow('\n⚠️  No Claude Code configuration found in the specified path.'));
      console.log(chalk.gray('   Make sure you are in a directory with Claude Code configuration files.'));
      return;
    }

    // Interactive mode - ask what to migrate
    let migrateOptions = {
      claudeMd: structure.hasClaudeMd,
      agents: structure.hasAgentsDir,
      skills: structure.hasSkillsDir,
      commands: structure.hasCommandsDir,
    };

    if (options.interactive !== false) {
      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'components',
          message: 'What do you want to migrate?',
          choices: [
            {
              name: 'CLAUDE.md → Memory Bank',
              value: 'claudeMd',
              checked: structure.hasClaudeMd,
              disabled: !structure.hasClaudeMd ? 'Not found' : false,
            },
            {
              name: 'agents/ → EGCE Agents',
              value: 'agents',
              checked: structure.hasAgentsDir,
              disabled: !structure.hasAgentsDir ? 'Not found' : false,
            },
            {
              name: 'skills/ → EGCE Configs',
              value: 'skills',
              checked: structure.hasSkillsDir,
              disabled: !structure.hasSkillsDir ? 'Not found' : false,
            },
            {
              name: 'commands/ → EGCE Prompts',
              value: 'commands',
              checked: structure.hasCommandsDir,
              disabled: !structure.hasCommandsDir ? 'Not found' : false,
            },
          ],
        },
      ]);

      migrateOptions = {
        claudeMd: answers.components.includes('claudeMd'),
        agents: answers.components.includes('agents'),
        skills: answers.components.includes('skills'),
        commands: answers.components.includes('commands'),
      };
    }

    if (dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run mode - no files will be written\n'));
    }

    // Initialize result
    const result: MigrationResult = {
      success: true,
      source: sourcePath,
      memoryBank: null,
      agents: null,
      configs: null,
      prompts: null,
      warnings: [],
      errors: [],
    };

    // Migrate CLAUDE.md → Memory Bank
    if (migrateOptions.claudeMd && structure.claudeMdPath) {
      spinner.start('Migrating CLAUDE.md to Memory Bank...');
      try {
        result.memoryBank = await migrateClaudeMd(
          structure.claudeMdPath,
          outputPath,
          dryRun,
          options.force
        );
        spinner.succeed(`Memory Bank created (${result.memoryBank.knowledgeEntries} knowledge entries, ${result.memoryBank.decisions} decisions)`);
      } catch (error) {
        spinner.fail('Failed to migrate CLAUDE.md');
        result.errors.push(`CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Migrate agents/ → EGCE Agents
    if (migrateOptions.agents && structure.agentsDirPath) {
      spinner.start('Migrating agents to EGCE format...');
      try {
        result.agents = await migrateAgents(
          structure.agentsDirPath,
          outputPath,
          dryRun,
          options.force
        );
        spinner.succeed(`Agents migrated (${result.agents.converted}/${result.agents.total})`);
      } catch (error) {
        spinner.fail('Failed to migrate agents');
        result.errors.push(`Agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Migrate skills/ → EGCE Configs
    if (migrateOptions.skills && structure.skillsDirPath) {
      spinner.start('Migrating skills to EGCE configs...');
      try {
        result.configs = await migrateSkills(
          structure.skillsDirPath,
          outputPath,
          dryRun,
          options.force
        );
        spinner.succeed(`Configs created (${result.configs.converted}/${result.configs.total})`);
      } catch (error) {
        spinner.fail('Failed to migrate skills');
        result.errors.push(`Skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Migrate commands/ → EGCE Prompts
    if (migrateOptions.commands && structure.commandsDirPath) {
      spinner.start('Migrating commands to EGCE prompts...');
      try {
        result.prompts = await migrateCommands(
          structure.commandsDirPath,
          outputPath,
          dryRun,
          options.force
        );
        spinner.succeed(`Prompts created (${result.prompts.converted}/${result.prompts.total})`);
      } catch (error) {
        spinner.fail('Failed to migrate commands');
        result.errors.push(`Commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Show summary
    console.log(chalk.cyan('\n📊 Migration Summary\n'));

    if (result.memoryBank) {
      console.log(chalk.white('Memory Bank:'));
      console.log(`   Project context: ${result.memoryBank.projectContext ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`   Team context:    ${result.memoryBank.teamContext ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`   Knowledge:       ${chalk.cyan(result.memoryBank.knowledgeEntries)} entries`);
      console.log(`   Decisions:       ${chalk.cyan(result.memoryBank.decisions)} ADRs`);
      console.log(`   Instructions:    ${chalk.cyan(result.memoryBank.instructions)} files`);
    }

    if (result.agents) {
      console.log(chalk.white('\nAgents:'));
      console.log(`   Converted: ${chalk.cyan(result.agents.converted)}/${result.agents.total}`);
      if (result.agents.files.length > 0 && result.agents.files.length <= 5) {
        for (const file of result.agents.files) {
          console.log(`   - ${chalk.gray(file)}`);
        }
      }
    }

    if (result.configs) {
      console.log(chalk.white('\nConfigs:'));
      console.log(`   Converted: ${chalk.cyan(result.configs.converted)}/${result.configs.total}`);
    }

    if (result.prompts) {
      console.log(chalk.white('\nPrompts:'));
      console.log(`   Converted: ${chalk.cyan(result.prompts.converted)}/${result.prompts.total}`);
    }

    // Show warnings
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      for (const warning of result.warnings) {
        console.log(`   - ${warning}`);
      }
    }

    // Show errors
    if (result.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:'));
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    // Final message
    if (result.success) {
      if (dryRun) {
        console.log(chalk.green('\n✓ Dry run completed successfully'));
        console.log(chalk.gray('  Run without --dry-run to actually migrate the files.'));
      } else {
        console.log(chalk.green('\n✓ Migration completed successfully'));
        console.log(chalk.gray('\n  Next steps:'));
        console.log(chalk.gray('  1. Review the generated files in .memory-bank/'));
        console.log(chalk.gray('  2. Run `egce validate` to check the configuration'));
        console.log(chalk.gray('  3. Commit the changes to your repository'));
      }
    } else {
      console.log(chalk.red('\n✗ Migration completed with errors'));
      console.log(chalk.gray('  Please review the errors above and try again.'));
    }

  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

/**
 * Detect Claude Code structure in the given path
 */
async function detectClaudeCodeStructure(basePath: string): Promise<ClaudeCodeStructure> {
  const structure: ClaudeCodeStructure = {
    hasClaudeMd: false,
    claudeMdPath: null,
    hasAgentsDir: false,
    agentsDirPath: null,
    hasSkillsDir: false,
    skillsDirPath: null,
    hasCommandsDir: false,
    commandsDirPath: null,
  };

  // Check for CLAUDE.md
  const claudeMdPaths = ['CLAUDE.md', 'claude.md', '.claude/CLAUDE.md'];
  for (const p of claudeMdPaths) {
    const fullPath = path.join(basePath, p);
    if (await fs.pathExists(fullPath)) {
      structure.hasClaudeMd = true;
      structure.claudeMdPath = fullPath;
      break;
    }
  }

  // Check for agents directory
  const agentsDirs = ['agents', '.claude/agents', 'ai-agents'];
  for (const dir of agentsDirs) {
    const fullPath = path.join(basePath, dir);
    if (await fs.pathExists(fullPath) && (await fs.stat(fullPath)).isDirectory()) {
      structure.hasAgentsDir = true;
      structure.agentsDirPath = fullPath;
      break;
    }
  }

  // Check for skills directory
  const skillsDirs = ['skills', '.claude/skills', 'ai-skills'];
  for (const dir of skillsDirs) {
    const fullPath = path.join(basePath, dir);
    if (await fs.pathExists(fullPath) && (await fs.stat(fullPath)).isDirectory()) {
      structure.hasSkillsDir = true;
      structure.skillsDirPath = fullPath;
      break;
    }
  }

  // Check for commands directory
  const commandsDirs = ['commands', '.claude/commands', 'ai-commands', 'prompts'];
  for (const dir of commandsDirs) {
    const fullPath = path.join(basePath, dir);
    if (await fs.pathExists(fullPath) && (await fs.stat(fullPath)).isDirectory()) {
      structure.hasCommandsDir = true;
      structure.commandsDirPath = fullPath;
      break;
    }
  }

  return structure;
}

/**
 * Migrate CLAUDE.md to Memory Bank
 */
async function migrateClaudeMd(
  claudeMdPath: string,
  outputPath: string,
  dryRun: boolean,
  force?: boolean
): Promise<MemoryBankResult> {
  const parser = new ClaudeMdParser();
  const conversion = await parser.parseAndConvert(claudeMdPath);

  const memoryBankPath = path.join(outputPath, '.memory-bank');

  if (!dryRun) {
    // Create Memory Bank directory structure
    await fs.ensureDir(path.join(memoryBankPath, 'project'));
    await fs.ensureDir(path.join(memoryBankPath, 'team'));
    await fs.ensureDir(path.join(memoryBankPath, 'modules'));
    await fs.ensureDir(path.join(memoryBankPath, 'decisions'));
    await fs.ensureDir(path.join(memoryBankPath, 'knowledge/patterns'));
    await fs.ensureDir(path.join(memoryBankPath, 'knowledge/antipatterns'));
    await fs.ensureDir(path.join(memoryBankPath, 'knowledge/rules'));

    // Write project context
    await writeProjectContext(
      path.join(memoryBankPath, 'project/context.md'),
      conversion.projectContext
    );

    // Write team context if available
    if (conversion.teamContext) {
      await writeTeamContext(
        path.join(memoryBankPath, 'team/context.md'),
        conversion.teamContext
      );
    }

    // Write knowledge entries
    for (const entry of conversion.knowledge) {
      const typeDir = entry.type === 'antipattern' ? 'antipatterns' :
                      entry.type === 'rule' ? 'rules' : 'patterns';
      const filePath = path.join(memoryBankPath, 'knowledge', typeDir, `${entry.id}.md`);
      await writeKnowledgeEntry(filePath, entry);
    }

    // Write decisions (ADRs)
    for (const decision of conversion.decisions) {
      const slug = decision.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const filePath = path.join(memoryBankPath, 'decisions', `${decision.id}-${slug}.md`);
      await writeDecisionRecord(filePath, decision);
    }

    // Write instructions
    const instructionsPath = path.join(outputPath, 'core/instructions');
    await fs.ensureDir(instructionsPath);

    for (const instruction of conversion.instructions) {
      const filePath = path.join(instructionsPath, `${instruction.name}.instructions.md`);
      await writeInstruction(filePath, instruction);
    }
  }

  return {
    projectContext: true,
    teamContext: conversion.teamContext !== null,
    knowledgeEntries: conversion.knowledge.length,
    decisions: conversion.decisions.length,
    instructions: conversion.instructions.length,
  };
}

/**
 * Migrate agents directory
 */
async function migrateAgents(
  agentsPath: string,
  outputPath: string,
  dryRun: boolean,
  force?: boolean
): Promise<AgentsResult> {
  const parser = new AgentsParser();
  const result = await parser.parseAndConvert(agentsPath);

  const agentsOutputPath = path.join(outputPath, 'core/agents');
  const files: string[] = [];

  if (!dryRun) {
    await fs.ensureDir(agentsOutputPath);

    for (const agent of result.agents) {
      const filePath = path.join(agentsOutputPath, `${agent.slug}.agent.md`);
      await writeAgent(filePath, agent);
      files.push(`${agent.slug}.agent.md`);
    }
  }

  return {
    total: result.summary.totalParsed,
    converted: result.summary.totalConverted,
    files,
  };
}

/**
 * Migrate skills directory
 */
async function migrateSkills(
  skillsPath: string,
  outputPath: string,
  dryRun: boolean,
  force?: boolean
): Promise<ConfigsResult> {
  const parser = new SkillsParser();
  const result = await parser.parseAndConvert(skillsPath);

  const configsOutputPath = path.join(outputPath, 'configs');
  const files: string[] = [];

  if (!dryRun) {
    await fs.ensureDir(configsOutputPath);

    for (const config of result.configs) {
      const filePath = path.join(configsOutputPath, `${config.slug}.config.yaml`);
      await writeConfig(filePath, config);
      files.push(`${config.slug}.config.yaml`);
    }
  }

  return {
    total: result.summary.totalParsed,
    converted: result.summary.totalConverted,
    files,
  };
}

/**
 * Migrate commands directory
 */
async function migrateCommands(
  commandsPath: string,
  outputPath: string,
  dryRun: boolean,
  force?: boolean
): Promise<PromptsResult> {
  const parser = new CommandsParser();
  const result = await parser.parseAndConvert(commandsPath);

  const promptsOutputPath = path.join(outputPath, 'core/prompts');
  const files: string[] = [];

  if (!dryRun) {
    await fs.ensureDir(promptsOutputPath);

    for (const prompt of result.prompts) {
      const filePath = path.join(promptsOutputPath, `${prompt.slug}.prompt.md`);
      await writePrompt(filePath, prompt);
      files.push(`${prompt.slug}.prompt.md`);
    }
  }

  return {
    total: result.summary.totalParsed,
    converted: result.summary.totalConverted,
    files,
  };
}

// File writing helpers

async function writeProjectContext(filePath: string, context: MemoryBankConversion['projectContext']): Promise<void> {
  const content = `---
name: "${context.name}"
description: "${context.description}"
version: "${context.version}"
lastUpdated: "${context.lastUpdated}"
status: "${context.status}"
---

# ${context.name}

${context.description}

## Technical Stack

### Languages
${context.technicalStack.languages.map(l => `- ${l}`).join('\n') || '- To be defined'}

### Frameworks
${context.technicalStack.frameworks.map(f => `- ${f}`).join('\n') || '- To be defined'}

### Databases
${context.technicalStack.databases.map(d => `- ${d}`).join('\n') || '- To be defined'}

### Infrastructure
${context.technicalStack.infrastructure.map(i => `- ${i}`).join('\n') || '- To be defined'}

### Tools
${context.technicalStack.tools.map(t => `- ${t}`).join('\n') || '- To be defined'}

## Architecture

**Style:** ${context.architecture.style}

${context.architecture.description}

### Patterns
${context.architecture.patterns.map(p => `- ${p}`).join('\n') || '- To be documented'}

### Layers
${context.architecture.layers.map(l => `- ${l}`).join('\n') || '- To be documented'}

## Conventions

### Naming
${context.conventions.naming.map(n => `- ${n}`).join('\n') || '- To be defined'}

### Code Style
${context.conventions.codeStyle.map(c => `- ${c}`).join('\n') || '- To be defined'}

### Testing
${context.conventions.testing.map(t => `- ${t}`).join('\n') || '- To be defined'}

### Git
${context.conventions.git.map(g => `- ${g}`).join('\n') || '- To be defined'}
`;

  await fs.writeFile(filePath, content);
}

async function writeTeamContext(filePath: string, context: MemoryBankConversion['teamContext']): Promise<void> {
  if (!context) return;

  const content = `---
name: "${context.name}"
description: "${context.description}"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
---

# ${context.name}

${context.description}

## Team Members
${context.members.map(m => `- ${m}`).join('\n') || '- To be defined'}

## Roles
${context.roles.map(r => `- ${r}`).join('\n') || '- To be defined'}

## Conventions
${context.conventions.map(c => `- ${c}`).join('\n') || '- See project conventions'}
`;

  await fs.writeFile(filePath, content);
}

async function writeKnowledgeEntry(filePath: string, entry: MemoryBankConversion['knowledge'][0]): Promise<void> {
  const content = `---
id: "${entry.id}"
title: "${entry.title}"
type: "${entry.type}"
tags: [${entry.tags.map(t => `"${t}"`).join(', ')}]
createdAt: "${new Date().toISOString().split('T')[0]}"
---

# ${entry.title}

${entry.content}
`;

  await fs.writeFile(filePath, content);
}

async function writeDecisionRecord(filePath: string, decision: MemoryBankConversion['decisions'][0]): Promise<void> {
  const content = `---
id: "${decision.id}"
title: "${decision.title}"
status: "${decision.status}"
date: "${new Date().toISOString().split('T')[0]}"
---

# ${decision.id}: ${decision.title}

## Status

${decision.status}

## Context

${decision.context}

## Decision

${decision.decision}

## Consequences

${decision.consequences}
`;

  await fs.writeFile(filePath, content);
}

async function writeInstruction(filePath: string, instruction: MemoryBankConversion['instructions'][0]): Promise<void> {
  const content = `---
name: "${instruction.name}"
description: "${instruction.description}"
applyWhen: [${instruction.applyWhen.map(a => `"${a}"`).join(', ')}]
---

# ${instruction.description}

${instruction.content}

## When to Apply

${instruction.applyWhen.map(a => `- ${a}`).join('\n')}
`;

  await fs.writeFile(filePath, content);
}

async function writeAgent(filePath: string, agent: EGCEAgent): Promise<void> {
  const content = `---
name: "${agent.name}"
slug: "${agent.slug}"
role: "${agent.role}"
version: "${agent.version}"
lastUpdated: "${agent.lastUpdated}"
---

# ${agent.name}

${agent.description}

## Role

${agent.role}

## Expertise

${agent.expertise.map(e => `- ${e}`).join('\n') || '- General development assistance'}

## Responsibilities

${agent.responsibilities.map(r => `- ${r}`).join('\n')}

## Instructions

${agent.instructions.map(cat => `
### ${cat.category}

${cat.items.map(i => `- ${i}`).join('\n')}
`).join('\n')}

## Constraints

${agent.constraints.map(c => `- ${c}`).join('\n') || '- Follow best practices and coding standards'}

## Tools

${agent.tools.map(t => `- **${t.name}**: ${t.description}`).join('\n') || '- Standard development tools'}

## Triggers

${agent.triggers.map(t => `- When: ${t.condition} → ${t.action}`).join('\n') || '- Activated on request'}

## Examples

${agent.examples.map(ex => `
### ${ex.scenario}

**Input:** ${ex.input}

**Output:** ${ex.output}
`).join('\n') || 'See documentation for examples.'}
`;

  await fs.writeFile(filePath, content);
}

async function writeConfig(filePath: string, config: EGCEConfig): Promise<void> {
  const yamlContent = yaml.dump({
    name: config.name,
    slug: config.slug,
    description: config.description,
    type: config.type,
    version: config.version,
    enabled: config.enabled,
    settings: config.settings,
    scope: config.scope,
    rules: config.rules,
    integrations: config.integrations,
  }, { lineWidth: 120 });

  await fs.writeFile(filePath, yamlContent);
}

async function writePrompt(filePath: string, prompt: EGCEPrompt): Promise<void> {
  const content = `---
name: "${prompt.name}"
slug: "${prompt.slug}"
title: "${prompt.title}"
category: "${prompt.category}"
version: "${prompt.version}"
lastUpdated: "${prompt.lastUpdated}"
trigger:
  slash: "${prompt.trigger.slash}"
  keywords: [${prompt.trigger.keywords.map(k => `"${k}"`).join(', ')}]
  autoTrigger: ${prompt.trigger.autoTrigger}
---

# ${prompt.title}

${prompt.description}

## Usage

\`\`\`
${prompt.trigger.slash}
\`\`\`

## Template

### System Prompt

\`\`\`
${prompt.template.system}
\`\`\`

### User Template

\`\`\`
${prompt.template.user}
\`\`\`

## Arguments

${prompt.arguments.map(a => `
### ${a.label}

- **Name:** \`${a.name}\`
- **Type:** ${a.type}
- **Required:** ${a.required}
- **Description:** ${a.description}
${a.default !== undefined ? `- **Default:** ${a.default}` : ''}
`).join('\n') || 'No arguments required.'}

## Context Requirements

### Required
${prompt.context.required.map(c => `- **${c.type}:** ${c.description}`).join('\n') || 'None'}

### Optional
${prompt.context.optional.map(c => `- **${c.type}:** ${c.description}`).join('\n') || 'None'}

## Output

- **Format:** ${prompt.output.format}

## Examples

${prompt.examples.map(ex => `
### ${ex.name}

${ex.description}

**Input:** \`${JSON.stringify(ex.input)}\`

**Output:**
\`\`\`
${ex.output}
\`\`\`
`).join('\n') || 'See usage section for examples.'}
`;

  await fs.writeFile(filePath, content);
}

export default migrateCommand;
