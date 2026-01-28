# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-28

### Added

#### Core Framework
- Complete Memory Bank system with JSON schemas and Markdown templates
- 8 cross-stack AI agents (Architect, Code Reviewer, Security Auditor, etc.)
- 6 enterprise instructions (standards, git workflow, testing, security, docs, review)
- 6 core prompts (analyze impact, review PR, document decision, estimate task, etc.)
- 4 chat modes (dev, review, architect, mentor)

#### CLI (`egce`)
- `egce init` - Initialize new EGCE projects with interactive setup
- `egce memory init` - Initialize Memory Bank structure
- `egce memory validate` - Validate Memory Bank content
- `egce memory sync` - Sync Memory Bank with remote
- `egce memory export` - Export Memory Bank to JSON
- `egce memory add-decision` - Add Architecture Decision Records (ADRs)
- `egce memory add-module` - Add module contexts
- `egce validate` - Validate all configurations
- `egce add-stack` - Add technology stack configurations (Java/Spring, .NET)
- `egce migrate` - Migrate from Claude Code configuration
- `egce doctor` - Check system health

#### Migration (Phase 7)
- CLAUDE.md parser with full conversion to Memory Bank format
- Agents parser for Claude Code agent migration
- Skills parser for Claude Code skill migration
- Commands parser for Claude Code command migration
- Interactive migration wizard
- Dry-run support for preview
- Comprehensive migration guide

#### Technology Stacks
- Java/Spring Boot 3.x/4.x support
  - Spring Architect agent
  - JPA Specialist agent
  - Spring Boot coding standards
  - REST controller generation prompts
- .NET 8/9 support
  - .NET Architect agent
  - .NET coding standards
  - Minimal API generation prompts

#### Documentation
- Getting Started guide
- Memory Bank guide
- Team Setup guide
- Migration guide (Claude Code → EGCE)
- API Reference
- Troubleshooting guide

#### Memory Bank Schemas
- `project-context.schema.json` - Project-level context
- `team-context.schema.json` - Team structure and conventions
- `module-context.schema.json` - Module/bounded context information
- `decision-record.schema.json` - Architecture Decision Records
- `knowledge-entry.schema.json` - Knowledge base entries
- `session-context.schema.json` - Session-specific context

#### Memory Bank Templates
- `project-context.template.md`
- `team-context.template.md`
- `module-context.template.md`
- `adr.template.md`
- `knowledge-entry.template.md`
- `troubleshooting.template.md`

### Technical Details

- TypeScript-based CLI with Commander.js
- JSON Schema validation with AJV
- YAML frontmatter support for Markdown files
- Monorepo structure with npm workspaces
- Node.js 20+ required

## [0.1.0] - 2025-01-27

### Added

- Initial project structure
- Basic Memory Bank schemas
- Core agent templates
- README and initial documentation

---

## Migration from Claude Code

If you're migrating from Claude Code, use the migration command:

```bash
egce migrate
```

See the [Migration Guide](docs/migration-guide.md) for detailed instructions.

## Links

- [Repository](https://github.com/exceptia/everything-github-copilot-enterprise)
- [Documentation](docs/)
- [Issues](https://github.com/exceptia/everything-github-copilot-enterprise/issues)
