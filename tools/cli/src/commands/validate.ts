/**
 * Validate Command
 *
 * Validates all EGCE configurations including Memory Bank, agents, and instructions.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import glob from 'glob';

import { MemoryBank } from '../memory-bank.js';
import { SchemaValidator } from '../schema-validator.js';

// Types
export interface ValidateOptions {
  memoryBank?: boolean;
  agents?: boolean;
  instructions?: boolean;
  fix?: boolean;
}

export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: ValidationError[];
  warningsList: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  message: string;
  line?: number;
}

export interface ValidationWarning {
  file: string;
  message: string;
}

/**
 * Main validate command handler
 */
export async function validateCommand(options: ValidateOptions): Promise<void> {
  const spinner = ora();

  console.log(chalk.cyan('\n🔍 EGCE Configuration Validator\n'));

  const summary: ValidationSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    warningsList: [],
  };

  try {
    // Determine what to validate
    const validateAll = !options.memoryBank && !options.agents && !options.instructions;

    // Validate Memory Bank
    if (validateAll || options.memoryBank) {
      spinner.start('Validating Memory Bank...');
      const mbResult = await validateMemoryBank();
      summary.total += mbResult.total;
      summary.passed += mbResult.passed;
      summary.failed += mbResult.failed;
      summary.warnings += mbResult.warnings;
      summary.errors.push(...mbResult.errors);
      summary.warningsList.push(...mbResult.warningsList);

      if (mbResult.failed > 0) {
        spinner.fail(`Memory Bank: ${mbResult.failed} errors`);
      } else if (mbResult.warnings > 0) {
        spinner.warn(`Memory Bank: ${mbResult.warnings} warnings`);
      } else {
        spinner.succeed(`Memory Bank: ${mbResult.passed} files valid`);
      }
    }

    // Validate Agents
    if (validateAll || options.agents) {
      spinner.start('Validating agents...');
      const agentsResult = await validateAgents();
      summary.total += agentsResult.total;
      summary.passed += agentsResult.passed;
      summary.failed += agentsResult.failed;
      summary.warnings += agentsResult.warnings;
      summary.errors.push(...agentsResult.errors);
      summary.warningsList.push(...agentsResult.warningsList);

      if (agentsResult.failed > 0) {
        spinner.fail(`Agents: ${agentsResult.failed} errors`);
      } else if (agentsResult.warnings > 0) {
        spinner.warn(`Agents: ${agentsResult.warnings} warnings`);
      } else {
        spinner.succeed(`Agents: ${agentsResult.passed} files valid`);
      }
    }

    // Validate Instructions
    if (validateAll || options.instructions) {
      spinner.start('Validating instructions...');
      const instructionsResult = await validateInstructions();
      summary.total += instructionsResult.total;
      summary.passed += instructionsResult.passed;
      summary.failed += instructionsResult.failed;
      summary.warnings += instructionsResult.warnings;
      summary.errors.push(...instructionsResult.errors);
      summary.warningsList.push(...instructionsResult.warningsList);

      if (instructionsResult.failed > 0) {
        spinner.fail(`Instructions: ${instructionsResult.failed} errors`);
      } else if (instructionsResult.warnings > 0) {
        spinner.warn(`Instructions: ${instructionsResult.warnings} warnings`);
      } else {
        spinner.succeed(`Instructions: ${instructionsResult.passed} files valid`);
      }
    }

    // Show summary
    console.log(chalk.cyan('\n📊 Validation Summary\n'));
    console.log(`   Total files:  ${chalk.white(summary.total)}`);
    console.log(`   Passed:       ${chalk.green(summary.passed)}`);
    console.log(`   Failed:       ${summary.failed > 0 ? chalk.red(summary.failed) : chalk.gray(summary.failed)}`);
    console.log(`   Warnings:     ${summary.warnings > 0 ? chalk.yellow(summary.warnings) : chalk.gray(summary.warnings)}`);

    // Show errors
    if (summary.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:\n'));
      for (const error of summary.errors) {
        console.log(`   ${chalk.red('•')} ${chalk.gray(error.file)}`);
        console.log(`     ${error.message}`);
        if (error.line) {
          console.log(`     ${chalk.gray(`Line ${error.line}`)}`);
        }
      }
    }

    // Show warnings
    if (summary.warningsList.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:\n'));
      for (const warning of summary.warningsList.slice(0, 10)) {
        console.log(`   ${chalk.yellow('•')} ${chalk.gray(warning.file)}`);
        console.log(`     ${warning.message}`);
      }
      if (summary.warningsList.length > 10) {
        console.log(chalk.gray(`   ... and ${summary.warningsList.length - 10} more warnings`));
      }
    }

    // Final status
    if (summary.failed === 0 && summary.warnings === 0) {
      console.log(chalk.green('\n✓ All configurations are valid!\n'));
    } else if (summary.failed === 0) {
      console.log(chalk.yellow('\n⚠️  Validation passed with warnings.\n'));
    } else {
      console.log(chalk.red('\n✗ Validation failed. Please fix the errors above.\n'));
      if (options.fix) {
        console.log(chalk.gray('   Note: --fix flag was provided but automatic fixes are not yet implemented.'));
      }
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Validation failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

/**
 * Validate Memory Bank structure and content
 */
async function validateMemoryBank(): Promise<ValidationSummary> {
  const summary: ValidationSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    warningsList: [],
  };

  const mbPath = '.memory-bank';

  // Check if Memory Bank exists
  if (!await fs.pathExists(mbPath)) {
    summary.warningsList.push({
      file: mbPath,
      message: 'Memory Bank not initialized. Run `egce init` to create it.',
    });
    summary.warnings++;
    return summary;
  }

  // Check required directories
  const requiredDirs = ['project', 'team', 'modules', 'decisions', 'knowledge'];
  for (const dir of requiredDirs) {
    const dirPath = path.join(mbPath, dir);
    summary.total++;

    if (!await fs.pathExists(dirPath)) {
      summary.errors.push({
        file: dirPath,
        message: `Required directory missing: ${dir}`,
      });
      summary.failed++;
    } else {
      summary.passed++;
    }
  }

  // Check project context
  const projectContext = path.join(mbPath, 'project/context.md');
  summary.total++;

  if (await fs.pathExists(projectContext)) {
    const content = await fs.readFile(projectContext, 'utf-8');

    // Check for frontmatter
    if (!content.startsWith('---')) {
      summary.errors.push({
        file: projectContext,
        message: 'Missing YAML frontmatter',
      });
      summary.failed++;
    } else if (content.includes('{{')) {
      summary.warningsList.push({
        file: projectContext,
        message: 'Contains unresolved template variables',
      });
      summary.warnings++;
      summary.passed++;
    } else {
      summary.passed++;
    }
  } else {
    summary.errors.push({
      file: projectContext,
      message: 'Project context file missing',
    });
    summary.failed++;
  }

  // Validate decision files
  const decisionsDir = path.join(mbPath, 'decisions');
  if (await fs.pathExists(decisionsDir)) {
    const decisionFiles = await glob.glob('*.md', { cwd: decisionsDir });

    for (const file of decisionFiles) {
      if (file.startsWith('.')) continue;

      summary.total++;
      const filePath = path.join(decisionsDir, file);

      // Check naming convention
      if (!file.match(/^ADR-\d{4}-.+\.md$/)) {
        summary.warningsList.push({
          file: filePath,
          message: 'Does not follow ADR naming convention (ADR-XXXX-title.md)',
        });
        summary.warnings++;
      }

      // Check content
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.includes('## Status')) {
        summary.warningsList.push({
          file: filePath,
          message: 'Missing "## Status" section',
        });
        summary.warnings++;
      }

      summary.passed++;
    }
  }

  // Validate knowledge entries
  const knowledgeDir = path.join(mbPath, 'knowledge');
  if (await fs.pathExists(knowledgeDir)) {
    const knowledgeFiles = await glob.glob('**/*.md', { cwd: knowledgeDir });

    for (const file of knowledgeFiles) {
      summary.total++;
      const filePath = path.join(knowledgeDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for frontmatter
      if (!content.startsWith('---')) {
        summary.warningsList.push({
          file: filePath,
          message: 'Missing YAML frontmatter',
        });
        summary.warnings++;
      }

      summary.passed++;
    }
  }

  return summary;
}

/**
 * Validate agent files
 */
async function validateAgents(): Promise<ValidationSummary> {
  const summary: ValidationSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    warningsList: [],
  };

  // Check common agent locations
  const agentDirs = ['core/agents', '.github/agents', 'agents'];
  let agentFiles: string[] = [];

  for (const dir of agentDirs) {
    if (await fs.pathExists(dir)) {
      const files = await glob.glob('**/*.agent.md', { cwd: dir });
      agentFiles.push(...files.map(f => path.join(dir, f)));
    }
  }

  if (agentFiles.length === 0) {
    summary.warningsList.push({
      file: 'agents',
      message: 'No agent files found',
    });
    summary.warnings++;
    return summary;
  }

  for (const file of agentFiles) {
    summary.total++;

    try {
      const content = await fs.readFile(file, 'utf-8');

      // Check for frontmatter
      if (!content.startsWith('---')) {
        summary.errors.push({
          file,
          message: 'Missing YAML frontmatter',
        });
        summary.failed++;
        continue;
      }

      // Check required sections
      const requiredSections = ['Role', 'Responsibilities'];
      for (const section of requiredSections) {
        if (!content.includes(`## ${section}`) && !content.includes(`# ${section}`)) {
          summary.warningsList.push({
            file,
            message: `Missing "${section}" section`,
          });
          summary.warnings++;
        }
      }

      summary.passed++;
    } catch (error) {
      summary.errors.push({
        file,
        message: `Failed to read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      summary.failed++;
    }
  }

  return summary;
}

/**
 * Validate instruction files
 */
async function validateInstructions(): Promise<ValidationSummary> {
  const summary: ValidationSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    warningsList: [],
  };

  // Check common instruction locations
  const instructionDirs = ['core/instructions', '.github/instructions', 'instructions'];
  let instructionFiles: string[] = [];

  for (const dir of instructionDirs) {
    if (await fs.pathExists(dir)) {
      const files = await glob.glob('**/*.instructions.md', { cwd: dir });
      instructionFiles.push(...files.map(f => path.join(dir, f)));
    }
  }

  if (instructionFiles.length === 0) {
    summary.warningsList.push({
      file: 'instructions',
      message: 'No instruction files found',
    });
    summary.warnings++;
    return summary;
  }

  for (const file of instructionFiles) {
    summary.total++;

    try {
      const content = await fs.readFile(file, 'utf-8');

      // Check for frontmatter
      if (!content.startsWith('---')) {
        summary.warningsList.push({
          file,
          message: 'Missing YAML frontmatter (recommended)',
        });
        summary.warnings++;
      }

      // Check for content
      if (content.length < 100) {
        summary.warningsList.push({
          file,
          message: 'Very short content (less than 100 characters)',
        });
        summary.warnings++;
      }

      summary.passed++;
    } catch (error) {
      summary.errors.push({
        file,
        message: `Failed to read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      summary.failed++;
    }
  }

  return summary;
}

export default validateCommand;
