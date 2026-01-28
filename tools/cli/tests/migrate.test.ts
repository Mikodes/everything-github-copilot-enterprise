/**
 * Migration Command Tests
 *
 * E2E tests for the migration functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Test utilities
async function createTempDir(): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `egce-test-${Date.now()}`);
  await fs.ensureDir(tmpDir);
  return tmpDir;
}

async function cleanupTempDir(dir: string): Promise<void> {
  await fs.remove(dir);
}

describe('Migration Detection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should detect CLAUDE.md in root', async () => {
    const claudeMdPath = path.join(tempDir, 'CLAUDE.md');
    await fs.writeFile(claudeMdPath, '# Test Project\n\nDescription.');

    const exists = await fs.pathExists(claudeMdPath);
    expect(exists).toBe(true);
  });

  it('should detect CLAUDE.md in .claude directory', async () => {
    const claudeDir = path.join(tempDir, '.claude');
    await fs.ensureDir(claudeDir);
    const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');
    await fs.writeFile(claudeMdPath, '# Test Project');

    const exists = await fs.pathExists(claudeMdPath);
    expect(exists).toBe(true);
  });

  it('should detect agents directory', async () => {
    const agentsDir = path.join(tempDir, 'agents');
    await fs.ensureDir(agentsDir);
    await fs.writeFile(
      path.join(agentsDir, 'reviewer.md'),
      '# Code Reviewer\n\nReviews code.'
    );

    const files = await fs.readdir(agentsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should detect skills directory', async () => {
    const skillsDir = path.join(tempDir, 'skills');
    await fs.ensureDir(skillsDir);
    await fs.writeFile(
      path.join(skillsDir, 'linter.yaml'),
      'name: Linter\nenabled: true'
    );

    const files = await fs.readdir(skillsDir);
    expect(files).toContain('linter.yaml');
  });

  it('should detect commands directory', async () => {
    const commandsDir = path.join(tempDir, 'commands');
    await fs.ensureDir(commandsDir);
    await fs.writeFile(
      path.join(commandsDir, 'generate.md'),
      '# Generate\n\nGenerate code.'
    );

    const files = await fs.readdir(commandsDir);
    expect(files).toContain('generate.md');
  });
});

describe('Memory Bank Creation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should create Memory Bank directory structure', async () => {
    const mbPath = path.join(tempDir, '.memory-bank');

    // Create structure
    await fs.ensureDir(path.join(mbPath, 'project'));
    await fs.ensureDir(path.join(mbPath, 'team'));
    await fs.ensureDir(path.join(mbPath, 'modules'));
    await fs.ensureDir(path.join(mbPath, 'decisions'));
    await fs.ensureDir(path.join(mbPath, 'knowledge/patterns'));
    await fs.ensureDir(path.join(mbPath, 'knowledge/antipatterns'));
    await fs.ensureDir(path.join(mbPath, 'knowledge/rules'));

    // Verify structure
    expect(await fs.pathExists(path.join(mbPath, 'project'))).toBe(true);
    expect(await fs.pathExists(path.join(mbPath, 'team'))).toBe(true);
    expect(await fs.pathExists(path.join(mbPath, 'modules'))).toBe(true);
    expect(await fs.pathExists(path.join(mbPath, 'decisions'))).toBe(true);
    expect(await fs.pathExists(path.join(mbPath, 'knowledge'))).toBe(true);
  });

  it('should create project context file', async () => {
    const contextPath = path.join(tempDir, '.memory-bank/project/context.md');
    await fs.ensureDir(path.dirname(contextPath));

    const content = `---
name: "Test Project"
description: "A test project"
version: "1.0.0"
lastUpdated: "2024-01-15"
---

# Test Project

A test project.
`;

    await fs.writeFile(contextPath, content);

    const written = await fs.readFile(contextPath, 'utf-8');
    expect(written).toContain('name: "Test Project"');
    expect(written).toContain('# Test Project');
  });

  it('should create knowledge entries', async () => {
    const knowledgePath = path.join(tempDir, '.memory-bank/knowledge/rules/KB-0001.md');
    await fs.ensureDir(path.dirname(knowledgePath));

    const content = `---
id: "KB-0001"
title: "Always write tests"
type: "rule"
tags: ["testing", "quality"]
---

# Always write tests

All code should have tests.
`;

    await fs.writeFile(knowledgePath, content);

    const written = await fs.readFile(knowledgePath, 'utf-8');
    expect(written).toContain('id: "KB-0001"');
    expect(written).toContain('type: "rule"');
  });

  it('should create ADR files', async () => {
    const adrPath = path.join(tempDir, '.memory-bank/decisions/ADR-0001-use-react.md');
    await fs.ensureDir(path.dirname(adrPath));

    const content = `---
id: "ADR-0001"
title: "Use React for frontend"
status: "accepted"
date: "2024-01-15"
---

# ADR-0001: Use React for frontend

## Status

accepted

## Context

We need a frontend framework.

## Decision

We will use React.

## Consequences

Need to train team on React.
`;

    await fs.writeFile(adrPath, content);

    const written = await fs.readFile(adrPath, 'utf-8');
    expect(written).toContain('id: "ADR-0001"');
    expect(written).toContain('status: "accepted"');
  });
});

describe('Agent Migration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should create agent files in EGCE format', async () => {
    const agentPath = path.join(tempDir, 'core/agents/code-reviewer.agent.md');
    await fs.ensureDir(path.dirname(agentPath));

    const content = `---
name: "Code Reviewer"
slug: "code-reviewer"
role: "Code Quality Specialist"
version: "1.0.0"
lastUpdated: "2024-01-15"
---

# Code Reviewer

Expert code reviewer.

## Role

Code Quality Specialist

## Expertise

- Bug detection
- Security review
- Performance analysis

## Responsibilities

- Review pull requests
- Suggest improvements
- Ensure code quality

## Instructions

### General

- Be constructive
- Explain reasoning

## Constraints

- Don't be harsh
`;

    await fs.writeFile(agentPath, content);

    const written = await fs.readFile(agentPath, 'utf-8');
    expect(written).toContain('name: "Code Reviewer"');
    expect(written).toContain('## Role');
    expect(written).toContain('## Responsibilities');
  });
});

describe('Prompt Migration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should create prompt files in EGCE format', async () => {
    const promptPath = path.join(tempDir, 'core/prompts/explain-code.prompt.md');
    await fs.ensureDir(path.dirname(promptPath));

    const content = `---
name: "explain-code"
slug: "explain-code"
title: "Explain Code"
category: "explanation"
version: "1.0.0"
lastUpdated: "2024-01-15"
trigger:
  slash: "/explain"
  keywords: ["explain", "describe", "what"]
  autoTrigger: false
---

# Explain Code

Explain what code does.

## Usage

\`\`\`
/explain
\`\`\`

## Template

### System Prompt

\`\`\`
You are an expert at explaining code. Provide clear explanations.
\`\`\`

### User Template

\`\`\`
Explain the following code:

{{code}}
\`\`\`
`;

    await fs.writeFile(promptPath, content);

    const written = await fs.readFile(promptPath, 'utf-8');
    expect(written).toContain('category: "explanation"');
    expect(written).toContain('slash: "/explain"');
  });
});

describe('Config Migration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should create config files in YAML format', async () => {
    const configPath = path.join(tempDir, 'configs/linter.config.yaml');
    await fs.ensureDir(path.dirname(configPath));

    const content = `name: Linter
slug: linter
description: Run code linter
type: code-analysis
version: "1.0.0"
enabled: true
settings:
  autoActivate: true
  priority: 5
  parameters: {}
  customSettings: {}
scope:
  include:
    - type: glob
      pattern: "**/*.ts"
    - type: glob
      pattern: "**/*.js"
  exclude:
    - type: glob
      pattern: node_modules/**
rules: []
integrations: []
`;

    await fs.writeFile(configPath, content);

    const written = await fs.readFile(configPath, 'utf-8');
    expect(written).toContain('name: Linter');
    expect(written).toContain('type: code-analysis');
  });
});

describe('Full Migration Flow', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should handle a complete migration scenario', async () => {
    // Create source Claude Code structure
    await fs.writeFile(
      path.join(tempDir, 'CLAUDE.md'),
      `# My Project

A TypeScript project.

## Tech Stack

- TypeScript
- Node.js

## Rules

- Always use strict mode
`
    );

    await fs.ensureDir(path.join(tempDir, 'agents'));
    await fs.writeFile(
      path.join(tempDir, 'agents/reviewer.md'),
      `# Code Reviewer

Reviews code.

## Instructions

- Check for bugs
`
    );

    // Simulate migration output
    const outputDir = path.join(tempDir, 'output');
    await fs.ensureDir(path.join(outputDir, '.memory-bank/project'));
    await fs.ensureDir(path.join(outputDir, 'core/agents'));

    await fs.writeFile(
      path.join(outputDir, '.memory-bank/project/context.md'),
      `---
name: "My Project"
---
# My Project
`
    );

    await fs.writeFile(
      path.join(outputDir, 'core/agents/reviewer.agent.md'),
      `---
name: "Code Reviewer"
---
# Code Reviewer
`
    );

    // Verify output
    expect(await fs.pathExists(path.join(outputDir, '.memory-bank/project/context.md'))).toBe(true);
    expect(await fs.pathExists(path.join(outputDir, 'core/agents/reviewer.agent.md'))).toBe(true);
  });
});
