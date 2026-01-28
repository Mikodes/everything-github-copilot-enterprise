# EGCE CLI API Reference

Complete reference for the EGCE (Everything GitHub Copilot Enterprise) Command Line Interface.

## Installation

```bash
npm install -g egce
```

Or use with npx:

```bash
npx egce <command>
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `egce init` | Initialize a new EGCE project |
| `egce memory` | Memory Bank management |
| `egce validate` | Validate configurations |
| `egce migrate` | Migrate from other formats |
| `egce add-stack` | Add technology stack configs |
| `egce doctor` | Check system health |

---

## `egce init`

Initialize a new EGCE project with Memory Bank and Copilot configurations.

### Usage

```bash
egce init [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --stack <stack>` | Technology stack (java-spring, dotnet, typescript) | - |
| `-f, --force` | Overwrite existing configuration | false |
| `--skip-memory-bank` | Skip Memory Bank initialization | false |

### Examples

```bash
# Interactive initialization
egce init

# Initialize with specific stack
egce init --stack java-spring

# Force reinitialize
egce init --force
```

### Output

Creates the following structure:

```
.memory-bank/
├── project/
│   └── context.md
├── team/
│   └── context.md
├── modules/
├── decisions/
└── knowledge/
    ├── patterns/
    ├── antipatterns/
    └── troubleshooting/
.github/
└── copilot-instructions.md
AGENTS.md
```

---

## `egce memory`

Memory Bank management commands.

### `egce memory init`

Initialize the Memory Bank structure.

```bash
egce memory init [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <template>` | Template to use | - |
| `-f, --force` | Overwrite existing | false |

### `egce memory validate`

Validate Memory Bank structure and content.

```bash
egce memory validate [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--fix` | Attempt to fix errors | false |

### `egce memory sync`

Sync Memory Bank with remote repository.

```bash
egce memory sync [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Show changes without syncing | false |

### `egce memory export`

Export Memory Bank to JSON format.

```bash
egce memory export [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output file path | `./memory-bank-export.json` |

### `egce memory add-decision`

Add a new Architecture Decision Record (ADR).

```bash
egce memory add-decision <title> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `title` | Decision title |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--status <status>` | Initial status | `proposed` |

**Status values:** `proposed`, `accepted`, `deprecated`, `superseded`

### `egce memory add-module`

Add a new module context.

```bash
egce memory add-module <name>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Module name |

---

## `egce validate`

Validate all EGCE configurations.

### Usage

```bash
egce validate [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--memory-bank` | Validate Memory Bank only | false |
| `--agents` | Validate agents only | false |
| `--instructions` | Validate instructions only | false |
| `--fix` | Attempt to fix errors | false |

### Examples

```bash
# Validate everything
egce validate

# Validate only Memory Bank
egce validate --memory-bank

# Validate with auto-fix
egce validate --fix
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Validation passed |
| 1 | Validation failed with errors |

---

## `egce migrate`

Migrate from other AI assistant configurations.

### Usage

```bash
egce migrate [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--from <source>` | Source format | `claude-code` |
| `--path <path>` | Source configuration path | Current directory |
| `--output <path>` | Output path | Current directory |
| `--dry-run` | Preview without making changes | false |
| `--force` | Overwrite existing files | false |
| `--no-interactive` | Skip interactive prompts | false |

### Supported Sources

| Source | Description |
|--------|-------------|
| `claude-code` | Claude Code configuration (CLAUDE.md, agents/, skills/, commands/) |

### Examples

```bash
# Interactive migration
egce migrate

# Dry run
egce migrate --dry-run

# Migrate from specific path
egce migrate --path /path/to/config

# Non-interactive with force
egce migrate --no-interactive --force
```

### What Gets Migrated

| Source | Destination |
|--------|-------------|
| `CLAUDE.md` | `.memory-bank/` (project, knowledge, decisions) |
| `agents/` | `core/agents/` |
| `skills/` | `configs/` |
| `commands/` | `core/prompts/` |

---

## `egce add-stack`

Add technology stack-specific configurations.

### Usage

```bash
egce add-stack <stack> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `stack` | Stack to add |

### Available Stacks

| Stack | Description |
|-------|-------------|
| `java-spring` | Java with Spring Boot 3.x/4.x |
| `dotnet` | .NET 8/9 with ASP.NET Core |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--version <version>` | Framework version | Latest |
| `--force` | Overwrite existing | false |

### Examples

```bash
# Add Java/Spring stack
egce add-stack java-spring

# Add specific version
egce add-stack java-spring --version 4.0

# Add .NET stack
egce add-stack dotnet --version 9
```

### Output

Creates stack-specific files:

```
stacks/<stack>/
├── agents/
│   └── <stack>-architect.agent.md
├── instructions/
│   └── <stack>-standards.instructions.md
└── prompts/
    └── create-<stack>-component.prompt.md
```

---

## `egce doctor`

Check system health and prerequisites.

### Usage

```bash
egce doctor
```

### Checks Performed

- Node.js version (requires >= 20.0.0)
- Git installation
- Memory Bank presence
- `.github` directory presence

### Example Output

```
🔍 Running system checks...

✓ Node.js v20.10.0
✓ Git installed
✓ Memory Bank found
○ .github directory not found

📋 Run `egce init` to set up your project.
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EGCE_DEBUG` | Enable debug output | false |
| `EGCE_NO_COLOR` | Disable colored output | false |

### Configuration File

EGCE looks for configuration in `.egcerc.json`:

```json
{
  "memoryBank": {
    "path": ".memory-bank"
  },
  "validation": {
    "strict": true
  }
}
```

---

## TypeScript API

EGCE can also be used programmatically:

```typescript
import { MemoryBank, SchemaValidator } from 'egce';

// Initialize Memory Bank
const mb = new MemoryBank({ rootPath: '.memory-bank' });
await mb.init();

// Validate
const result = await mb.validate();
console.log(result.valid);

// Load structure
const structure = await mb.load();
console.log(structure.project);
```

### MemoryBank Class

```typescript
class MemoryBank {
  constructor(config?: Partial<MemoryBankConfig>);

  init(options?: { force?: boolean; template?: string }): Promise<void>;
  isInitialized(): Promise<boolean>;
  load(): Promise<MemoryBankStructure>;
  validate(): Promise<ValidationResult>;
  addModule(name: string, context?: Partial<ModuleContext>): Promise<string>;
  addDecision(title: string, options?: { status?: string }): Promise<string>;
  export(): Promise<Record<string, unknown>>;
  search(query: string): Promise<SearchResult[]>;
}
```

### SchemaValidator Class

```typescript
class SchemaValidator {
  constructor(schemasPath?: string);

  loadSchemas(): Promise<void>;
  validate(schemaName: string, data: unknown): Promise<ValidationResult>;
  validateFile(filePath: string, schemaName?: string): Promise<ValidationResult>;
  validateMemoryBank(mbPath: string): Promise<ValidationResult>;
  getAvailableSchemas(): Promise<SchemaInfo[]>;
  generateExample(schemaName: string): Promise<Record<string, unknown> | null>;
}
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error / validation failed |
| 2 | Invalid arguments |
| 130 | Interrupted (Ctrl+C) |

---

## Version Information

```bash
egce --version
```

---

## Getting Help

```bash
# General help
egce --help

# Command-specific help
egce <command> --help
```
