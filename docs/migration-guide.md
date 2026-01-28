# Migration Guide: Claude Code to EGCE

This guide explains how to migrate your existing Claude Code configuration to the Everything GitHub Copilot Enterprise (EGCE) framework.

## Overview

EGCE provides a migration tool that automatically converts Claude Code configurations to the EGCE format. The migration preserves your existing customizations while providing the benefits of the EGCE Memory Bank system.

## What Gets Migrated

| Claude Code | EGCE Equivalent |
|-------------|-----------------|
| `CLAUDE.md` | Memory Bank (project context, knowledge, decisions) |
| `agents/` | `core/agents/` (EGCE agent format) |
| `skills/` | `configs/` (EGCE config files) |
| `commands/` | `core/prompts/` (EGCE prompt format) |

## Prerequisites

Before migrating, ensure you have:

1. **Node.js 20+** installed
2. **EGCE CLI** installed globally:
   ```bash
   npm install -g egce
   ```
3. A project with Claude Code configuration (CLAUDE.md, agents/, etc.)

## Quick Start

The fastest way to migrate is using the interactive migration command:

```bash
# Navigate to your project
cd /path/to/your/project

# Run the migration
egce migrate
```

The CLI will:
1. Detect your Claude Code configuration
2. Ask which components to migrate
3. Convert and create EGCE files
4. Provide a summary of the migration

## Step-by-Step Migration

### Step 1: Backup Your Configuration

Before migrating, create a backup of your existing configuration:

```bash
# Create a backup
cp -r .claude .claude.backup
cp CLAUDE.md CLAUDE.md.backup
```

### Step 2: Run Dry Run

First, run a dry run to see what will be migrated without making changes:

```bash
egce migrate --dry-run
```

Review the output to understand:
- What files will be created
- Any warnings or potential issues
- The structure of the migrated configuration

### Step 3: Execute Migration

If the dry run looks good, run the actual migration:

```bash
egce migrate
```

Or specify options:

```bash
egce migrate --from claude-code --path /path/to/config
```

### Step 4: Validate

After migration, validate the new configuration:

```bash
egce validate
```

### Step 5: Review and Customize

Review the migrated files and customize as needed:

1. **Memory Bank** (`.memory-bank/`)
   - Review `project/context.md` for accuracy
   - Add missing technical stack details
   - Update team information in `team/context.md`

2. **Agents** (`core/agents/`)
   - Check agent instructions are complete
   - Add any missing capabilities
   - Customize triggers and examples

3. **Prompts** (`core/prompts/`)
   - Verify prompt templates
   - Update system prompts if needed
   - Add more examples

## Migration Details

### CLAUDE.md → Memory Bank

The migration parses your `CLAUDE.md` file and extracts:

| CLAUDE.md Section | Memory Bank Location |
|-------------------|---------------------|
| Project overview | `.memory-bank/project/context.md` |
| Tech stack | Project context → Technical Stack |
| Architecture | Project context → Architecture |
| Conventions | Project context → Conventions |
| Rules/Guidelines | `.memory-bank/knowledge/rules/` |
| Patterns | `.memory-bank/knowledge/patterns/` |
| Anti-patterns | `.memory-bank/knowledge/antipatterns/` |
| Decisions | `.memory-bank/decisions/` |

#### Example Conversion

**Before (CLAUDE.md):**
```markdown
# My Project

A TypeScript web application.

## Tech Stack
- TypeScript
- React
- PostgreSQL

## Rules
- Always use TypeScript strict mode
- Write unit tests for all functions
```

**After (Memory Bank):**

`.memory-bank/project/context.md`:
```markdown
---
name: "My Project"
description: "A TypeScript web application"
version: "1.0.0"
---

# My Project

A TypeScript web application.

## Technical Stack

### Languages
- TypeScript

### Frameworks
- React

### Databases
- PostgreSQL
```

`.memory-bank/knowledge/rules/KB-0001.md`:
```markdown
---
id: "KB-0001"
title: "Always use TypeScript strict mode"
type: "rule"
---

# Always use TypeScript strict mode

TypeScript strict mode should always be enabled.
```

### Agents Migration

Claude Code agents are converted to EGCE agent format with:

- **Preserved**: Name, description, instructions, examples
- **Added**: YAML frontmatter, standardized sections
- **Organized**: Categories, triggers, constraints

#### Example Agent Conversion

**Before:**
```markdown
# Code Reviewer

Reviews code for quality.

## Instructions
- Check for bugs
- Verify tests exist
```

**After:**
```markdown
---
name: "Code Reviewer"
slug: "code-reviewer"
role: "Code Quality Specialist"
version: "1.0.0"
---

# Code Reviewer

Reviews code for quality.

## Role

Code Quality Specialist

## Responsibilities

- Review code for quality issues
- Check for bugs
- Verify tests exist

## Instructions

### General

- Check for bugs
- Verify tests exist

## Constraints

- Follow best practices and coding standards
```

### Commands → Prompts

Claude Code commands are converted to EGCE prompts with:

- **Preserved**: Trigger, template, arguments
- **Added**: Category, keywords, context requirements
- **Enhanced**: System prompts, output format

## CLI Reference

### `egce migrate`

```bash
egce migrate [options]

Options:
  --from <source>    Source format (default: "claude-code")
  --path <path>      Path to source configuration (default: current directory)
  --output <path>    Output path for migrated files (default: current directory)
  --dry-run          Show what would be migrated without making changes
  --force            Overwrite existing files
  --no-interactive   Skip interactive prompts
```

### Examples

```bash
# Interactive migration
egce migrate

# Dry run
egce migrate --dry-run

# Specific path
egce migrate --path ./my-claude-config

# Non-interactive with force
egce migrate --no-interactive --force

# Custom output directory
egce migrate --output ./new-egce-project
```

## Troubleshooting

### "No Claude Code configuration found"

**Cause:** The migration tool couldn't find `CLAUDE.md`, `agents/`, `skills/`, or `commands/` directories.

**Solution:**
1. Make sure you're in the correct directory
2. Check if your configuration uses non-standard paths
3. Use `--path` to specify the configuration location

### "Failed to parse CLAUDE.md"

**Cause:** The CLAUDE.md file has unexpected formatting.

**Solution:**
1. Check for syntax errors in your CLAUDE.md
2. Ensure headers use standard Markdown format (`# Title`)
3. Try migrating with verbose output: `egce migrate --verbose`

### "Memory Bank already exists"

**Cause:** A `.memory-bank` directory already exists.

**Solution:**
1. Back up existing Memory Bank
2. Use `--force` to overwrite
3. Or manually merge configurations

### Migration created empty files

**Cause:** The parser couldn't extract meaningful content from your configuration.

**Solution:**
1. Review your original configuration
2. Check the migration warnings for details
3. Manually transfer important content

## Post-Migration Checklist

After migration, complete these steps:

- [ ] Run `egce validate` to check for errors
- [ ] Review `.memory-bank/project/context.md`
- [ ] Update team information in `.memory-bank/team/context.md`
- [ ] Test agents with sample requests
- [ ] Verify prompts work as expected
- [ ] Commit the migrated files to version control
- [ ] Remove backup files after verification

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Run `egce doctor` for system diagnostics
3. Open an issue on [GitHub](https://github.com/exceptia/everything-github-copilot-enterprise/issues)

## Reverting Migration

If you need to revert:

```bash
# Remove migrated files
rm -rf .memory-bank core/agents core/prompts configs

# Restore backups
mv CLAUDE.md.backup CLAUDE.md
mv .claude.backup .claude
```

## Next Steps

After successful migration:

1. **Learn EGCE features**: Read the [Getting Started Guide](./getting-started.md)
2. **Explore Memory Bank**: See the [Memory Bank Guide](./memory-bank-guide.md)
3. **Add stack configs**: Run `egce add-stack java-spring` or `egce add-stack dotnet`
4. **Set up team workflows**: Follow the [Team Setup Guide](./team-setup.md)
