/**
 * Memory Bank Commands
 *
 * Commands for managing the Memory Bank.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

import { MemoryBank } from '../../memory-bank.js';

// Types
interface InitOptions {
  template?: string;
  force?: boolean;
}

interface ValidateOptions {
  fix?: boolean;
}

interface SyncOptions {
  dryRun?: boolean;
}

interface ExportOptions {
  output?: string;
}

interface AddDecisionOptions {
  status?: string;
}

/**
 * Memory Bank commands collection
 */
export const memoryCommands = {
  /**
   * Initialize Memory Bank
   */
  async init(options: InitOptions): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan('\n📚 Initializing Memory Bank\n'));

    try {
      const memoryBank = new MemoryBank();
      const isInitialized = await memoryBank.isInitialized();

      if (isInitialized && !options.force) {
        console.log(chalk.yellow('⚠️  Memory Bank already exists.'));

        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to reinitialize? This will overwrite existing files.',
            default: false,
          },
        ]);

        if (!proceed) {
          console.log(chalk.gray('Initialization cancelled.'));
          return;
        }
      }

      spinner.start('Creating Memory Bank structure...');
      await memoryBank.init({ force: options.force || isInitialized, template: options.template });
      spinner.succeed('Memory Bank created');

      console.log(chalk.cyan('\n✨ Memory Bank initialized!\n'));
      console.log(chalk.white('Structure created:'));
      console.log(chalk.green('  ✓ .memory-bank/'));
      console.log(chalk.gray('    ├── project/context.md'));
      console.log(chalk.gray('    ├── team/context.md'));
      console.log(chalk.gray('    ├── modules/'));
      console.log(chalk.gray('    ├── decisions/'));
      console.log(chalk.gray('    └── knowledge/'));

      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.gray('  1. Edit .memory-bank/project/context.md with your project details'));
      console.log(chalk.gray('  2. Run `egce memory validate` to check your setup'));

    } catch (error) {
      spinner.fail('Initialization failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },

  /**
   * Validate Memory Bank
   */
  async validate(options: ValidateOptions): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan('\n🔍 Validating Memory Bank\n'));

    try {
      const memoryBank = new MemoryBank();

      spinner.start('Checking Memory Bank structure...');
      const result = await memoryBank.validate();
      spinner.stop();

      if (result.valid) {
        console.log(chalk.green('✓ Memory Bank is valid!'));
      } else {
        console.log(chalk.red('✗ Memory Bank has errors:'));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.path}: ${error.message}`));
        }
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  - ${warning.path}: ${warning.message}`));
        }
      }

      if (!result.valid) {
        process.exit(1);
      }

    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },

  /**
   * Sync Memory Bank with remote
   */
  async sync(options: SyncOptions): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan('\n🔄 Syncing Memory Bank\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('Dry run mode - no changes will be made\n'));
    }

    try {
      const memoryBank = new MemoryBank();

      if (!await memoryBank.isInitialized()) {
        console.log(chalk.red('❌ Memory Bank not initialized. Run `egce memory init` first.'));
        return;
      }

      spinner.start('Checking for changes...');

      // For now, just show what would be synced
      const structure = await memoryBank.load();

      spinner.succeed('Sync check complete');

      console.log(chalk.white('\nMemory Bank contents:'));
      console.log(`  Project context: ${structure.project ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`  Team context: ${structure.team ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`  Modules: ${chalk.cyan(structure.modules.size)}`);
      console.log(`  Decisions: ${chalk.cyan(structure.decisions.length)}`);
      console.log(`  Knowledge: ${chalk.cyan(structure.knowledge.length)}`);

      console.log(chalk.gray('\nNote: Remote sync functionality will be added in a future version.'));

    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },

  /**
   * Export Memory Bank
   */
  async export(options: ExportOptions): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan('\n📤 Exporting Memory Bank\n'));

    try {
      const memoryBank = new MemoryBank();

      if (!await memoryBank.isInitialized()) {
        console.log(chalk.red('❌ Memory Bank not initialized. Run `egce memory init` first.'));
        return;
      }

      spinner.start('Exporting Memory Bank...');

      const exportData = await memoryBank.export();
      const outputPath = options.output || './memory-bank-export.json';

      await fs.writeJson(outputPath, exportData, { spaces: 2 });

      spinner.succeed(`Memory Bank exported to ${outputPath}`);

      console.log(chalk.cyan('\nExport summary:'));
      console.log(`  Project: ${exportData.project ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`  Team: ${exportData.team ? chalk.green('✓') : chalk.gray('✗')}`);
      console.log(`  Modules: ${chalk.cyan(Object.keys(exportData.modules || {}).length)}`);
      console.log(`  Decisions: ${chalk.cyan((exportData.decisions as unknown[])?.length || 0)}`);
      console.log(`  Knowledge: ${chalk.cyan((exportData.knowledge as unknown[])?.length || 0)}`);

    } catch (error) {
      spinner.fail('Export failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },

  /**
   * Add a new decision record (ADR)
   */
  async addDecision(title: string, options: AddDecisionOptions): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan('\n📝 Adding Architecture Decision Record\n'));

    try {
      const memoryBank = new MemoryBank();

      if (!await memoryBank.isInitialized()) {
        console.log(chalk.red('❌ Memory Bank not initialized. Run `egce memory init` first.'));
        return;
      }

      // Get additional details if not provided
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'status',
          message: 'Initial status:',
          choices: ['proposed', 'accepted', 'deprecated', 'superseded'],
          default: options.status || 'proposed',
        },
        {
          type: 'editor',
          name: 'context',
          message: 'Context (what is the issue/problem?):',
          default: '# Context\n\nDescribe the context and problem statement here.',
        },
        {
          type: 'editor',
          name: 'decision',
          message: 'Decision (what was decided?):',
          default: '# Decision\n\nDescribe the decision that was made here.',
        },
      ]);

      spinner.start('Creating ADR...');

      const adrPath = await memoryBank.addDecision(title, { status: answers.status });

      // Update the file with full content
      let content = await fs.readFile(adrPath, 'utf-8');
      content = content
        .replace('## Context\n\n{{context}}', `## Context\n\n${answers.context}`)
        .replace('## Decision\n\n{{decision}}', `## Decision\n\n${answers.decision}`);
      await fs.writeFile(adrPath, content);

      spinner.succeed(`ADR created: ${path.basename(adrPath)}`);

      console.log(chalk.cyan(`\n✨ Created: ${adrPath}`));
      console.log(chalk.gray('\nEdit the file to add more details about consequences and alternatives.'));

    } catch (error) {
      spinner.fail('Failed to create ADR');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },

  /**
   * Add a new module context
   */
  async addModule(name: string): Promise<void> {
    const spinner = ora();

    console.log(chalk.cyan(`\n📁 Adding Module: ${name}\n`));

    try {
      const memoryBank = new MemoryBank();

      if (!await memoryBank.isInitialized()) {
        console.log(chalk.red('❌ Memory Bank not initialized. Run `egce memory init` first.'));
        return;
      }

      // Get module details
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Module description:',
          default: `The ${name} module`,
        },
        {
          type: 'input',
          name: 'owner',
          message: 'Module owner (team or person):',
          default: 'Unassigned',
        },
      ]);

      spinner.start('Creating module context...');

      const modulePath = await memoryBank.addModule(name, {
        name,
        description: answers.description,
        lastUpdated: new Date().toISOString().split('T')[0],
      });

      // Update with owner info
      let content = await fs.readFile(modulePath, 'utf-8');
      content = content.replace('{{owner}}', answers.owner);
      await fs.writeFile(modulePath, content);

      spinner.succeed(`Module created: ${name}`);

      console.log(chalk.cyan(`\n✨ Created: ${modulePath}`));
      console.log(chalk.gray('\nEdit the file to add more details about the module.'));

    } catch (error) {
      spinner.fail('Failed to create module');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  },
};

export default memoryCommands;
