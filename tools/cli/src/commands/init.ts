/**
 * Init Command
 *
 * Initializes a new EGCE project with Memory Bank and Copilot configurations.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

import { MemoryBank } from '../memory-bank.js';

// Types
export interface InitOptions {
  stack?: string;
  force?: boolean;
  skipMemoryBank?: boolean;
}

/**
 * Main init command handler
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora();

  console.log(chalk.cyan('\n🚀 EGCE Project Initialization\n'));

  try {
    // Check if already initialized
    const memoryBank = new MemoryBank();
    const isInitialized = await memoryBank.isInitialized();

    if (isInitialized && !options.force) {
      console.log(chalk.yellow('⚠️  Project already initialized.'));
      console.log(chalk.gray('   Use --force to reinitialize.\n'));

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to reinitialize?',
          default: false,
        },
      ]);

      if (!proceed) {
        console.log(chalk.gray('Initialization cancelled.'));
        return;
      }
    }

    // Gather project information
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: path.basename(process.cwd()),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'Enterprise project with GitHub Copilot configuration',
      },
      {
        type: 'list',
        name: 'stack',
        message: 'Primary technology stack:',
        choices: [
          { name: 'TypeScript/Node.js', value: 'typescript' },
          { name: 'Java/Spring Boot', value: 'java-spring' },
          { name: '.NET/C#', value: 'dotnet' },
          { name: 'Python', value: 'python' },
          { name: 'Generic (no specific stack)', value: 'generic' },
        ],
        default: options.stack || 'generic',
      },
      {
        type: 'confirm',
        name: 'initMemoryBank',
        message: 'Initialize Memory Bank?',
        default: !options.skipMemoryBank,
      },
      {
        type: 'confirm',
        name: 'initGitHub',
        message: 'Create .github/copilot-instructions.md?',
        default: true,
      },
    ]);

    // Initialize Memory Bank
    if (answers.initMemoryBank) {
      spinner.start('Creating Memory Bank structure...');
      await memoryBank.init({ force: options.force || isInitialized });
      spinner.succeed('Memory Bank created');

      // Update project context with user input
      spinner.start('Updating project context...');
      const projectContextPath = '.memory-bank/project/context.md';
      let content = await fs.readFile(projectContextPath, 'utf-8');
      content = content
        .replace('{{project_name}}', answers.projectName)
        .replace('{{project_description}}', answers.description)
        .replace('{{date}}', new Date().toISOString().split('T')[0]);
      await fs.writeFile(projectContextPath, content);
      spinner.succeed('Project context updated');
    }

    // Create .github directory and copilot instructions
    if (answers.initGitHub) {
      spinner.start('Creating GitHub Copilot configuration...');

      await fs.ensureDir('.github');

      const copilotInstructions = `# GitHub Copilot Instructions

This project uses EGCE (Everything GitHub Copilot Enterprise) for AI-assisted development.

## Memory Bank

The project's Memory Bank is located at \`.memory-bank/\` and contains:
- Project context and conventions
- Architecture Decision Records (ADRs)
- Knowledge base entries
- Team information

## Code Style

Follow the conventions defined in \`.memory-bank/project/context.md\`.

## Stack

Primary stack: ${answers.stack}

## Important Files

- \`.memory-bank/project/context.md\` - Project overview
- \`.memory-bank/decisions/\` - Architecture decisions
- \`.memory-bank/knowledge/\` - Patterns and best practices

## Getting Help

Run \`egce doctor\` to check your setup.
Run \`egce memory validate\` to validate the Memory Bank.
`;

      await fs.writeFile('.github/copilot-instructions.md', copilotInstructions);
      spinner.succeed('GitHub Copilot configuration created');
    }

    // Create AGENTS.md for Copilot
    spinner.start('Creating AGENTS.md...');
    const agentsMd = `# AGENTS.md

This file provides instructions for AI assistants working on this project.

## Project: ${answers.projectName}

${answers.description}

## Memory Bank Location

The project's context and knowledge is stored in \`.memory-bank/\`:

- **Project Context**: \`.memory-bank/project/context.md\`
- **Team Context**: \`.memory-bank/team/context.md\`
- **Decisions**: \`.memory-bank/decisions/\`
- **Knowledge Base**: \`.memory-bank/knowledge/\`

## Before Making Changes

1. Read the project context in \`.memory-bank/project/context.md\`
2. Check relevant Architecture Decision Records in \`.memory-bank/decisions/\`
3. Review applicable patterns in \`.memory-bank/knowledge/patterns/\`

## Code Standards

Follow the conventions defined in the Memory Bank project context.

## Stack

- Primary: ${answers.stack}
- See \`.memory-bank/project/context.md\` for full technical stack

## Commands

- \`egce memory validate\` - Validate Memory Bank
- \`egce memory add-decision\` - Add new ADR
- \`egce validate\` - Validate all configurations
`;

    await fs.writeFile('AGENTS.md', agentsMd);
    spinner.succeed('AGENTS.md created');

    // Summary
    console.log(chalk.cyan('\n✨ Project initialized successfully!\n'));
    console.log(chalk.white('Created:'));

    if (answers.initMemoryBank) {
      console.log(chalk.green('  ✓ .memory-bank/'));
      console.log(chalk.gray('    ├── project/context.md'));
      console.log(chalk.gray('    ├── team/context.md'));
      console.log(chalk.gray('    ├── modules/'));
      console.log(chalk.gray('    ├── decisions/'));
      console.log(chalk.gray('    └── knowledge/'));
    }

    if (answers.initGitHub) {
      console.log(chalk.green('  ✓ .github/copilot-instructions.md'));
    }

    console.log(chalk.green('  ✓ AGENTS.md'));

    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray('  1. Review and update .memory-bank/project/context.md'));
    console.log(chalk.gray('  2. Add team members to .memory-bank/team/context.md'));
    console.log(chalk.gray('  3. Run `egce memory validate` to check your setup'));

    if (answers.stack !== 'generic') {
      console.log(chalk.gray(`  4. Run \`egce add-stack ${answers.stack}\` to add stack-specific configs`));
    }

  } catch (error) {
    spinner.fail('Initialization failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export default initCommand;
