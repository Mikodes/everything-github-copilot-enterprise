# EGCE Memory Bank - VS Code Extension

Visual Memory Bank management for **Everything GitHub Copilot Enterprise**.

## Features

### Memory Bank Explorer

Browse and manage your project's Memory Bank directly from the VS Code sidebar:

- **Core Context**: Project, team, and active session context files
- **Modules**: Bounded contexts and module definitions
- **Knowledge Base**: Reusable knowledge entries

### Agent Selector

Quick access to all available EGCE agents:

- Architect
- Code Reviewer
- Security Auditor
- Onboarding Guide
- Knowledge Curator
- Tech Debt Tracker
- Performance Analyst
- ADR Writer

### Architecture Decision Records (ADRs)

Manage your project's architectural decisions:

- View all ADRs with status indicators
- Create new ADRs from templates
- Track decision lifecycle (proposed → accepted → deprecated)

## Commands

| Command | Description |
|---------|-------------|
| `EGCE: Initialize Memory Bank Project` | Create a new Memory Bank in your workspace |
| `EGCE: Update Context` | Update project, team, or session context |
| `EGCE: Add Architecture Decision Record` | Create a new ADR |
| `EGCE: Select Agent` | Choose an agent for your current task |
| `EGCE: Refresh Memory Bank` | Refresh all Memory Bank views |
| `EGCE: Validate Memory Bank` | Check for issues in your context files |
| `EGCE: Create Context File` | Add a new module or knowledge entry |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `egce.memoryBankPath` | `.memory-bank` | Path to Memory Bank directory |
| `egce.autoValidate` | `true` | Auto-validate files on save |
| `egce.defaultStack` | `generic` | Default technology stack |
| `egce.showDecoratorIcons` | `true` | Show icons in tree view |

## Getting Started

1. Open a workspace in VS Code
2. Run **EGCE: Initialize Memory Bank Project** from the Command Palette
3. Fill in your project context in the generated files
4. Use the Memory Bank sidebar to navigate and manage context

## Memory Bank Structure

```
.memory-bank/
├── project-context.md      # Project overview and architecture
├── team-context.md         # Team structure and roles
├── active-context.md       # Current session context
├── modules/                # Bounded context definitions
│   └── *.md
├── decisions/              # Architecture Decision Records
│   └── 0001-*.md
└── knowledge/              # Reusable knowledge entries
    └── *.md
```

## Requirements

- VS Code 1.85.0 or higher
- A workspace with or without existing Memory Bank

## Installation

### From VS Code Marketplace

Search for "EGCE Memory Bank" in the Extensions view.

### From VSIX

1. Download the `.vsix` file
2. Run `code --install-extension egce-memory-bank-x.x.x.vsix`

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npm run package
```

## Related

- [EGCE Core Framework](../../README.md)
- [Memory Bank Guide](../../docs/memory-bank-guide.md)
- [CLI Tool](../cli/README.md)

## License

MIT
