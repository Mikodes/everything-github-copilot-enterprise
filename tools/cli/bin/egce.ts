#!/usr/bin/env node

/**
 * EGCE - Everything GitHub Copilot Enterprise
 * 
 * CLI tool for managing Memory Bank and GitHub Copilot configurations
 * for enterprise development teams.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from '../commands/init.js';
import { memoryCommands } from '../commands/memory/index.js';
import { addStackCommand } from '../commands/add-stack.js';
import { validateCommand } from '../commands/validate.js';
import { migrateCommand } from '../commands/migrate.js';

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('EGCE')} - Everything GitHub Copilot Enterprise           ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Enterprise-grade Copilot configs with Memory Bank')}      ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

program
  .name('egce')
  .description('Everything GitHub Copilot Enterprise - CLI for Memory Bank and Copilot configurations')
  .version('0.1.0')
  .addHelpText('beforeAll', banner);

// Init command
program
  .command('init')
  .description('Initialize a new project with Memory Bank and Copilot configurations')
  .option('-s, --stack <stack>', 'Technology stack (java-spring, dotnet)')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--skip-memory-bank', 'Skip Memory Bank initialization')
  .action(initCommand);

// Memory Bank commands
const memory = program
  .command('memory')
  .description('Memory Bank management commands');

memory
  .command('init')
  .description('Initialize Memory Bank in current project')
  .option('-t, --template <template>', 'Template to use')
  .action(memoryCommands.init);

memory
  .command('validate')
  .description('Validate Memory Bank structure and content')
  .option('--fix', 'Attempt to fix validation errors')
  .action(memoryCommands.validate);

memory
  .command('sync')
  .description('Sync Memory Bank with remote repository')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(memoryCommands.sync);

memory
  .command('export')
  .description('Export Memory Bank for web dashboard')
  .option('-o, --output <path>', 'Output path', './memory-bank-export.json')
  .action(memoryCommands.export);

memory
  .command('add-decision')
  .description('Add a new Architecture Decision Record (ADR)')
  .argument('<title>', 'Decision title')
  .option('--status <status>', 'Initial status', 'proposed')
  .action(memoryCommands.addDecision);

memory
  .command('add-module')
  .description('Add a new module context')
  .argument('<name>', 'Module name')
  .action(memoryCommands.addModule);

// Add stack command
program
  .command('add-stack')
  .description('Add technology stack configurations')
  .argument('<stack>', 'Stack to add (java-spring, dotnet)')
  .option('--version <version>', 'Framework version')
  .action(addStackCommand);

// Validate command
program
  .command('validate')
  .description('Validate all configurations')
  .option('--memory-bank', 'Validate Memory Bank only')
  .option('--agents', 'Validate agents only')
  .option('--instructions', 'Validate instructions only')
  .action(validateCommand);

// Migrate command
program
  .command('migrate')
  .description('Migrate from other configurations')
  .option('--from <source>', 'Source format (claude-code)')
  .option('--path <path>', 'Path to source configuration')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .action(migrateCommand);

// Doctor command - check system health
program
  .command('doctor')
  .description('Check system health and prerequisites')
  .action(async () => {
    console.log(chalk.cyan('\n🔍 Running system checks...\n'));
    
    // Check Node version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor >= 20) {
      console.log(chalk.green(`✓ Node.js ${nodeVersion}`));
    } else {
      console.log(chalk.red(`✗ Node.js ${nodeVersion} (requires >= 20.0.0)`));
    }
    
    // Check for git
    const { execSync } = await import('child_process');
    try {
      execSync('git --version', { stdio: 'pipe' });
      console.log(chalk.green('✓ Git installed'));
    } catch {
      console.log(chalk.red('✗ Git not found'));
    }
    
    // Check for Memory Bank
    const fs = await import('fs-extra');
    if (await fs.pathExists('.memory-bank')) {
      console.log(chalk.green('✓ Memory Bank found'));
    } else {
      console.log(chalk.yellow('○ Memory Bank not initialized'));
    }
    
    // Check for .github directory
    if (await fs.pathExists('.github')) {
      console.log(chalk.green('✓ .github directory found'));
    } else {
      console.log(chalk.yellow('○ .github directory not found'));
    }
    
    console.log(chalk.cyan('\n📋 Run `egce init` to set up your project.\n'));
  });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
