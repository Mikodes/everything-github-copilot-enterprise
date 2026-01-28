# Memory Bank

This folder contains contextual information for GitHub Copilot to understand our project better.

## Structure

```
.memory-bank/
├── project/           # Project-level context
│   └── context.md     # Technology stack, architecture overview
├── team/              # Team information
│   └── context.md     # Team structure, conventions
├── modules/           # Domain-specific contexts
│   ├── orders/
│   │   └── context.md
│   └── products/
│       └── context.md
├── decisions/         # Architecture Decision Records
│   ├── 001-clean-architecture.md
│   └── 002-cqrs-mediatr.md
└── knowledge/         # Shared knowledge
    ├── patterns.md
    └── troubleshooting.md
```

## How to Use

### For Developers

1. **Before starting work**: Read the relevant module context
2. **When making decisions**: Check existing ADRs
3. **When facing issues**: Check troubleshooting guide
4. **After significant changes**: Update affected contexts

### For GitHub Copilot

Copilot automatically reads these files to understand:
- What technology stack we use
- What patterns are approved
- What coding standards to follow
- Domain-specific terminology

### Keeping Updated

- Update `project/context.md` when major dependencies change
- Add new ADRs for significant architecture decisions
- Add troubleshooting entries when solving complex issues
- Update module contexts when adding new features

## Quick Reference

| Need | Check |
|------|-------|
| Tech stack | `project/context.md` |
| Coding standards | `team/context.md` |
| Feature details | `modules/{feature}/context.md` |
| Past decisions | `decisions/*.md` |
| Best practices | `knowledge/patterns.md` |
| Common issues | `knowledge/troubleshooting.md` |
