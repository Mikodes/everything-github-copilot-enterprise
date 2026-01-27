# AGENTS.md - Everything GitHub Copilot Enterprise

This file provides instructions to GitHub Copilot and other AI coding assistants about this project.

## Project Overview

**Everything GitHub Copilot Enterprise (EGCE)** is a framework for configuring GitHub Copilot in enterprise environments with:
- Memory Bank system for shared team context
- Java/Spring and .NET stack support
- Enterprise tool integrations (Jira, Azure DevOps, etc.)

## Memory Bank

This project uses the Memory Bank pattern for maintaining context. When working on any file:

1. **Check the Memory Bank first**: Look in `.memory-bank/` for relevant context
2. **Update Memory Bank**: After significant changes, suggest updating relevant context files
3. **Reference ADRs**: Check `.memory-bank/decisions/` before making architectural decisions

### Memory Bank Structure

```
.memory-bank/
├── project/           # Project-wide context
│   ├── context.md     # Project overview
│   ├── architecture.md
│   └── glossary.md
├── decisions/         # Architecture Decision Records
├── modules/           # Per-module context
└── knowledge/         # Team knowledge base
```

## Development Guidelines

### Code Style

- Use TypeScript for all CLI and tooling code
- Follow enterprise-standards as defined in `core/instructions/`
- All public APIs need documentation
- Minimum 80% test coverage for new code

### Commit Messages

Use Conventional Commits format:
```
<type>(<scope>): <subject>

feat(memory-bank): add export command
fix(cli): handle missing config file
docs(readme): update installation instructions
```

### Directory Structure

- `core/` - Base framework (agents, instructions, prompts, memory-bank)
- `stacks/` - Technology-specific configurations (java-spring, dotnet)
- `team-workflows/` - Team collaboration workflows
- `tools/` - CLI, VS Code extension, web dashboard
- `mcp-configs/` - MCP server configurations
- `examples/` - Example project configurations

## When Adding New Features

1. Check if there's an existing ADR or pattern
2. Consider impact on both Java and .NET stacks
3. Update relevant Memory Bank templates
4. Add appropriate tests
5. Update documentation

## Agent Tools Available

The following custom agents are available in `core/agents/`:

- **architect**: System design and architecture decisions
- **code-reviewer**: Code review with team standards
- **onboarding-guide**: Help new developers understand the codebase
- **security-auditor**: Security analysis
- **knowledge-curator**: Memory Bank maintenance

## Important Files

- `BACKLOG.md` - Project backlog with all tasks
- `core/memory-bank/schemas/` - JSON schemas for validation
- `core/memory-bank/templates/` - Templates for new contexts
- `tools/cli/` - CLI tool source code

## Schemas

All Memory Bank content should validate against schemas in `core/memory-bank/schemas/`:
- `project-context.schema.json`
- `module-context.schema.json`
- `decision-record.schema.json`
- `knowledge-entry.schema.json`
