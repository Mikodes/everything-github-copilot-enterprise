# Memory Bank Guide

The Memory Bank is EGCE's solution to the context problem - it gives GitHub Copilot (and your team) a shared understanding of your project, decisions, and best practices.

## Why Memory Bank?

### The Problem

- AI assistants lose context between sessions
- Team knowledge lives in people's heads
- New developers have a steep learning curve
- Documentation gets outdated or ignored

### The Solution

The Memory Bank is a structured directory that:
- Persists context across sessions
- Shares knowledge across the team
- Serves as living documentation
- Integrates with Copilot for context-aware assistance

## Structure

```
.memory-bank/
├── README.md
├── project/
│   └── context.md          # Project-level information
├── team/
│   └── context.md          # Team structure & practices
├── modules/
│   └── {module-name}/
│       └── context.md      # Module-specific context
├── decisions/
│   └── ADR-XXXX-title.md   # Architecture Decision Records
└── knowledge/
    ├── patterns/           # Approved patterns
    ├── antipatterns/       # Things to avoid
    ├── troubleshooting/    # Problem solutions
    └── best-practices/     # Best practices
```

## Components

### Project Context

**Location**: `.memory-bank/project/context.md`

The central source of truth about your project.

**What to Include**:
- Project name and description
- Business domain
- Technology stack
- Architecture overview
- Quality standards
- Key integrations

**Example**:
```markdown
---
name: Order Management System
description: Enterprise order processing platform
version: 2.1.0
lastUpdated: 2024-01-15
status: production
---

# Project Context

## Overview

The Order Management System handles all order processing
for our e-commerce platform, serving 50,000+ daily orders.

## Technology Stack

- **Language**: Java 21
- **Framework**: Spring Boot 3.2
- **Database**: PostgreSQL 15
- **Messaging**: Apache Kafka

## Architecture

Modular monolith with 5 bounded contexts:
- Order Management
- Inventory
- Fulfillment
- Notifications
- Analytics
```

### Team Context

**Location**: `.memory-bank/team/context.md`

Information about your team structure and working practices.

**What to Include**:
- Team members and roles
- Working agreements
- Communication channels
- Development practices
- Meeting schedules

### Module Context

**Location**: `.memory-bank/modules/{name}/context.md`

Per-module documentation for larger projects.

**What to Include**:
- Module responsibilities
- Ubiquitous language (domain terms)
- Key components
- Dependencies
- API contracts
- Testing strategy

### Architecture Decision Records (ADRs)

**Location**: `.memory-bank/decisions/`

Document significant technical decisions.

**Naming**: `ADR-XXXX-short-title.md`

**When to Create**:
- Technology choices
- Architecture patterns
- Major refactoring
- Breaking changes
- Trade-off decisions

**Creating an ADR**:
```bash
egce memory add-decision "Use event sourcing for order history"
```

### Knowledge Base

**Location**: `.memory-bank/knowledge/`

Reusable patterns, troubleshooting guides, and best practices.

#### Patterns
Approved patterns with examples:
```markdown
# Pattern: Repository Pattern

## When to Use
- Data access abstraction needed
- Multiple data sources possible
- Unit testing of data access

## Implementation
[Code examples...]
```

#### Anti-Patterns
Document what to avoid:
```markdown
# Anti-Pattern: Service Locator

## Why to Avoid
- Hidden dependencies
- Hard to test
- Violates DI principles

## Instead, Use
Constructor injection with DI container
```

#### Troubleshooting
Solutions to common problems:
```markdown
# Troubleshooting: Connection Pool Exhaustion

## Symptoms
- TimeoutExceptions in logs
- Slow response times
- Periodic request failures

## Solution
1. Check for unclosed connections
2. Increase pool size
3. Add connection timeout
```

## Best Practices

### Keep It Current

- Update after significant changes
- Review monthly
- Include update dates
- Remove outdated content

### Make It Discoverable

- Use consistent naming
- Add tags and keywords
- Cross-reference related content
- Use clear titles

### Start Small

- Begin with project context
- Add module contexts as needed
- Document decisions as they happen
- Build knowledge base over time

### Team Ownership

- Everyone can contribute
- Review changes in PRs
- Discuss in team meetings
- Rotate curation duty

## Commands

### Initialize Memory Bank

```bash
egce memory init
```

### Validate Structure

```bash
egce memory validate
# With auto-fix
egce memory validate --fix
```

### Add Module

```bash
egce memory add-module order-service
```

### Add Decision

```bash
egce memory add-decision "Migrate to PostgreSQL"
```

### Export for Dashboard

```bash
egce memory export -o memory-bank.json
```

### Search Memory Bank

```bash
# Search is built into Copilot agents
# They automatically search relevant entries
```

## Integration with Copilot

### How Copilot Uses Memory Bank

1. **Context Loading**: Agents read project/team context
2. **Module Awareness**: Code assistance uses module context
3. **Pattern Application**: Suggestions follow documented patterns
4. **Decision Respect**: Recommendations align with ADRs

### Example Agent Usage

The Architect agent automatically:
```markdown
1. Reads `.memory-bank/project/context.md`
2. Checks existing ADRs
3. Reviews relevant module contexts
4. Applies documented patterns
```

## Migration

### From Existing Documentation

1. Identify existing docs
2. Map to Memory Bank structure
3. Convert format
4. Validate with `egce memory validate`

### From Other Tools

```bash
# Migrate from Claude Code format
egce migrate --from claude-code --path ./claude-config
```

## Maintenance

### Weekly

- Review recent additions
- Check for duplicates
- Update outdated entries

### Monthly

- Full validation
- Remove deprecated content
- Update statistics

### Quarterly

- Structure review
- Knowledge audit
- Team feedback

## FAQ

### How much should I document?

Start with the essentials:
1. Project context
2. Key architectural decisions
3. Critical patterns

Add more as questions arise. If someone asks a question twice, document the answer.

### Who maintains the Memory Bank?

Everyone contributes, but consider:
- **Tech Lead**: Project context, architecture
- **Team**: Module contexts, troubleshooting
- **Architects**: ADRs, patterns
- **Rotating Curator**: Weekly reviews

### Can I use it without EGCE CLI?

Yes! The Memory Bank is just markdown files. You can:
- Create files manually
- Use any markdown editor
- Skip the CLI entirely

The CLI just makes it easier.

### Does it work with other AI tools?

The Memory Bank is tool-agnostic. While optimized for GitHub Copilot, it's useful for:
- Other AI assistants
- Human documentation
- Onboarding materials
- Architecture documentation
