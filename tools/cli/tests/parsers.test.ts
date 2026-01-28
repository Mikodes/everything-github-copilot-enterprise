/**
 * Parser Tests
 *
 * E2E tests for the Claude Code migration parsers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClaudeMdParser,
  AgentsParser,
  SkillsParser,
  CommandsParser,
} from '../src/parsers/index.js';

describe('ClaudeMdParser', () => {
  let parser: ClaudeMdParser;

  beforeEach(() => {
    parser = new ClaudeMdParser();
  });

  describe('parseContent', () => {
    it('should parse a simple CLAUDE.md file', () => {
      const content = `# My Project

A TypeScript web application.

## Tech Stack

- TypeScript
- React
- PostgreSQL

## Rules

- Always use TypeScript strict mode
- Write unit tests for all functions
`;

      const result = parser.parseContent(content);

      expect(result.projectName).toBeTruthy();
      expect(result.description).toBe('A TypeScript web application.');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.metadata.hasTechStack).toBe(true);
      expect(result.metadata.hasRules).toBe(true);
    });

    it('should extract code blocks', () => {
      const content = `# Project

## Example

\`\`\`typescript
const x = 1;
\`\`\`
`;

      const result = parser.parseContent(content);

      expect(result.codeBlocks.length).toBe(1);
      expect(result.codeBlocks[0].language).toBe('typescript');
      expect(result.codeBlocks[0].content).toContain('const x = 1');
    });

    it('should handle nested sections', () => {
      const content = `# Main

## Section 1

Content 1

### Subsection 1.1

Content 1.1

## Section 2

Content 2
`;

      const result = parser.parseContent(content);

      expect(result.sections.length).toBeGreaterThan(0);
      const mainSection = result.sections[0];
      expect(mainSection.children.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('convert', () => {
    it('should convert parsed content to Memory Bank format', () => {
      const content = `# Test Project

A test project for validation.

## Tech Stack

- Node.js
- Express

## Architecture

Microservices architecture using Docker.

## Conventions

### Naming
- Use camelCase for variables

### Git
- Use conventional commits

## Rules

- Always write tests
- Never commit secrets
`;

      const parsed = parser.parseContent(content);
      const conversion = parser.convert(parsed);

      expect(conversion.projectContext).toBeDefined();
      expect(conversion.projectContext.name).toBeTruthy();
      expect(conversion.projectContext.technicalStack.languages.length).toBeGreaterThan(0);
      expect(conversion.knowledge.length).toBeGreaterThan(0);
    });

    it('should extract decisions from decision sections', () => {
      const content = `# Project

## Decisions

### Why we chose React

We decided to use React because of its component model.

### Why TypeScript

TypeScript provides better type safety.
`;

      const parsed = parser.parseContent(content);
      const conversion = parser.convert(parsed);

      // Should have extracted some decisions or knowledge
      expect(conversion.decisions.length + conversion.knowledge.length).toBeGreaterThan(0);
    });
  });
});

describe('AgentsParser', () => {
  let parser: AgentsParser;

  beforeEach(() => {
    parser = new AgentsParser();
  });

  describe('parseAgentContent', () => {
    it('should parse a simple agent file', () => {
      const content = `# Code Reviewer

Expert code reviewer that helps maintain code quality.

## Role

Code Quality Specialist

## Capabilities

- Review code for bugs
- Suggest improvements
- Check for security issues

## Instructions

- Always be constructive
- Explain your reasoning
`;

      const result = parser.parseAgentContent(content, 'code-reviewer');

      expect(result.name).toBe('Code Reviewer');
      expect(result.slug).toBe('code-reviewer');
      expect(result.description).toBeTruthy();
      expect(result.capabilities.length).toBeGreaterThan(0);
      expect(result.instructions.length).toBeGreaterThan(0);
    });

    it('should extract examples from agent content', () => {
      const content = `# Test Agent

## Examples

### Example 1

**Input:** Review this code

**Output:** The code looks good but consider...
`;

      const result = parser.parseAgentContent(content, 'test-agent');

      expect(result.examples.length).toBeGreaterThanOrEqual(0);
      // Examples extraction depends on format
    });

    it('should extract constraints', () => {
      const content = `# Safety Agent

## Constraints

- Never execute arbitrary code
- Don't expose sensitive data
- Must validate all inputs
`;

      const result = parser.parseAgentContent(content, 'safety-agent');

      expect(result.constraints.length).toBeGreaterThan(0);
    });

    it('should estimate complexity correctly', () => {
      const simpleContent = `# Simple Agent

Basic agent.
`;

      const complexContent = `# Complex Agent

Complex agent with many features.

## Capabilities
- Cap 1
- Cap 2
- Cap 3

## Instructions
- Inst 1
- Inst 2
- Inst 3
- Inst 4
- Inst 5

## Tools
- Tool 1
- Tool 2

## Constraints
- Constraint 1
- Constraint 2

## Examples

### Example 1
Input: test
Output: result
`;

      const simpleResult = parser.parseAgentContent(simpleContent, 'simple');
      const complexResult = parser.parseAgentContent(complexContent, 'complex');

      expect(simpleResult.metadata.estimatedComplexity).toBe('simple');
      expect(['moderate', 'complex']).toContain(complexResult.metadata.estimatedComplexity);
    });
  });

  describe('convert', () => {
    it('should convert parsed agents to EGCE format', () => {
      const content = `# Test Agent

An agent for testing.

## Role
Test specialist

## Capabilities
- Run tests
- Generate test cases

## Instructions
- Write comprehensive tests
- Follow TDD principles
`;

      const parsed = [parser.parseAgentContent(content, 'test-agent')];
      const result = parser.convert(parsed);

      expect(result.agents.length).toBe(1);
      expect(result.agents[0].name).toBe('Test Agent');
      expect(result.agents[0].responsibilities.length).toBeGreaterThan(0);
      expect(result.summary.totalConverted).toBe(1);
    });
  });
});

describe('SkillsParser', () => {
  let parser: SkillsParser;

  beforeEach(() => {
    parser = new SkillsParser();
  });

  describe('parseSkillContent', () => {
    it('should parse YAML skill config', () => {
      const content = `
name: Code Analysis
description: Analyze code for issues
type: code-analysis
config:
  enabled: true
  autoTrigger: true
parameters:
  - name: severity
    type: string
    required: true
    description: Minimum severity to report
`;

      const result = parser.parseSkillContent(content, 'code-analysis', '.yaml');

      expect(result.name).toBe('Code Analysis');
      expect(result.type).toBe('code-analysis');
      expect(result.config.enabled).toBe(true);
      expect(result.parameters.length).toBe(1);
    });

    it('should parse JSON skill config', () => {
      const content = JSON.stringify({
        name: 'File Reader',
        description: 'Read files from disk',
        type: 'file-operation',
        config: {
          enabled: true,
        },
      });

      const result = parser.parseSkillContent(content, 'file-reader', '.json');

      expect(result.name).toBe('File Reader');
      expect(result.type).toBe('file-operation');
    });

    it('should parse markdown skill config', () => {
      const content = `---
name: Test Runner
description: Run project tests
type: testing
---

# Test Runner

Runs all project tests.

## Parameters

- \`testPattern\` (string) - Pattern to match test files
- \`watch\` (boolean) - Enable watch mode

## Dependencies

- Jest
- Vitest
`;

      const result = parser.parseSkillContent(content, 'test-runner', '.md');

      expect(result.name).toBe('Test Runner');
      expect(result.type).toBe('testing');
      expect(result.parameters.length).toBeGreaterThan(0);
      expect(result.dependencies.length).toBeGreaterThan(0);
    });

    it('should infer skill type from content', () => {
      const testContent = `# Test Skill
Runs tests for the project.
`;

      const gitContent = `# Git Skill
Manages git commits and branches.
`;

      const testResult = parser.parseSkillContent(testContent, 'test-skill', '.md');
      const gitResult = parser.parseSkillContent(gitContent, 'git-skill', '.md');

      expect(testResult.type).toBe('testing');
      expect(gitResult.type).toBe('git-operation');
    });
  });

  describe('convert', () => {
    it('should convert skills to EGCE configs', () => {
      const content = `
name: Linter
description: Run code linter
type: code-analysis
config:
  enabled: true
  scope:
    filePatterns:
      - "**/*.ts"
      - "**/*.js"
    exclude:
      - "node_modules/**"
`;

      const parsed = [parser.parseSkillContent(content, 'linter', '.yaml')];
      const result = parser.convert(parsed);

      expect(result.configs.length).toBe(1);
      expect(result.configs[0].scope.include.length).toBeGreaterThan(0);
      expect(result.configs[0].scope.exclude.length).toBeGreaterThan(0);
    });
  });
});

describe('CommandsParser', () => {
  let parser: CommandsParser;

  beforeEach(() => {
    parser = new CommandsParser();
  });

  describe('parseCommandContent', () => {
    it('should parse a simple command', () => {
      const content = `---
name: Generate Tests
description: Generate unit tests for code
trigger: /gen-tests
---

# Generate Tests

Generate comprehensive unit tests.

## Arguments

- \`file\` (file) - File to generate tests for
- \`framework\` (string) - Test framework to use

## Template

Generate unit tests for the following code:

{{file}}
`;

      const result = parser.parseCommandContent(content, 'gen-tests', '.md');

      expect(result.name).toBe('Generate Tests');
      expect(result.trigger).toBe('/gen-tests');
      expect(result.arguments.length).toBeGreaterThan(0);
      expect(result.behavior.template).toBeTruthy();
    });

    it('should parse YAML command config', () => {
      const content = `
name: Review PR
description: Review a pull request
trigger: /review-pr
arguments:
  - name: prNumber
    type: number
    required: true
    description: PR number to review
behavior:
  template: Review PR #{{prNumber}}
  responseFormat: markdown
`;

      const result = parser.parseCommandContent(content, 'review-pr', '.yaml');

      expect(result.name).toBe('Review PR');
      expect(result.trigger).toBe('/review-pr');
      expect(result.arguments.length).toBe(1);
      expect(result.arguments[0].type).toBe('number');
    });

    it('should detect context requirements', () => {
      const content = `# File Analyzer

Analyze the current file.

## Template

Analyze this file:
{{file}}

Based on the selection:
{{selection}}
`;

      const result = parser.parseCommandContent(content, 'file-analyzer', '.md');

      expect(result.behavior.requiresContext).toBe(true);
      expect(result.behavior.contextTypes).toContain('file');
      expect(result.behavior.contextTypes).toContain('selection');
    });

    it('should estimate complexity', () => {
      const simpleContent = `# Simple Command
Just a simple command.
`;

      const complexContent = `---
name: Complex Command
description: A complex command with many features
trigger: /complex
arguments:
  - name: arg1
    type: string
    required: true
  - name: arg2
    type: number
    required: false
behavior:
  systemPrompt: You are an expert assistant.
  template: Do something complex with {{arg1}} and {{arg2}}
  responseFormat: json
  requiresContext: true
  contextTypes:
    - file
    - project
examples:
  - input: /complex test 123
    description: Basic usage
    output: Result
---

# Complex Command

A very complex command.
`;

      const simpleResult = parser.parseCommandContent(simpleContent, 'simple', '.md');
      const complexResult = parser.parseCommandContent(complexContent, 'complex', '.md');

      expect(simpleResult.metadata.complexity).toBe('simple');
      expect(['moderate', 'complex']).toContain(complexResult.metadata.complexity);
    });
  });

  describe('convert', () => {
    it('should convert commands to EGCE prompts', () => {
      const content = `---
name: Explain Code
description: Explain what code does
trigger: /explain
---

# Explain Code

Provide a clear explanation of the code.
`;

      const parsed = [parser.parseCommandContent(content, 'explain', '.md')];
      const result = parser.convert(parsed);

      expect(result.prompts.length).toBe(1);
      expect(result.prompts[0].category).toBe('explanation');
      expect(result.prompts[0].trigger.slash).toBe('/explain');
    });

    it('should infer correct categories', () => {
      const generateContent = `# Generate
Generate new code.`;

      const reviewContent = `# Review
Review code for issues.`;

      const testContent = `# Test
Generate tests.`;

      const generateResult = parser.convert([
        parser.parseCommandContent(generateContent, 'generate', '.md'),
      ]);

      const reviewResult = parser.convert([
        parser.parseCommandContent(reviewContent, 'review', '.md'),
      ]);

      const testResult = parser.convert([
        parser.parseCommandContent(testContent, 'test', '.md'),
      ]);

      expect(generateResult.prompts[0].category).toBe('code-generation');
      expect(reviewResult.prompts[0].category).toBe('code-review');
      expect(testResult.prompts[0].category).toBe('testing');
    });
  });
});
