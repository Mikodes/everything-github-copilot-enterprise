# 🚀 Everything GitHub Copilot Enterprise

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Enterprise-grade GitHub Copilot configuration framework with Memory Bank for teams.**

Production-ready agents, instructions, prompts, and configurations for Java/Spring and .NET ecosystems. Includes a shared Memory Bank system to maintain context across team members.

---

## 🎯 What Problem Does This Solve?

In enterprise teams, AI coding assistants suffer from **context fragmentation**:

| Problem | Impact |
|---------|--------|
| Each developer has their own context | Inconsistent architectural decisions |
| Tribal knowledge isn't shared | Slow onboarding, repeated mistakes |
| Design decisions get lost | Constant reinvention |
| Project patterns aren't documented | Heterogeneous codebase |
| Business context is individual | Technically correct but functionally wrong solutions |

**Everything GitHub Copilot Enterprise** solves this with:

- 🧠 **Memory Bank**: Shared context system for teams
- ☕ **Java/Spring Stack**: Complete support for Spring Boot 3.x/4.x
- 🔷 **.NET Stack**: Complete support for .NET 8/9
- 👥 **Team Workflows**: Onboarding, code review, architecture decisions
- 🔌 **Enterprise MCPs**: Jira, Confluence, Azure DevOps integration

---

## 📦 What's Inside

```
everything-github-copilot-enterprise/
├── core/                    # Base framework
│   ├── memory-bank/         # 🧠 Memory Bank system
│   │   ├── schemas/         # JSON validation schemas
│   │   └── templates/       # Context templates
│   ├── agents/              # Cross-stack agents
│   ├── instructions/        # Enterprise standards
│   ├── prompts/             # Common prompts
│   └── chatmodes/           # Chat modes
│
├── stacks/                  # Technology-specific configs
│   ├── java-spring/         # ☕ Java/Spring ecosystem
│   ├── dotnet/              # 🔷 .NET ecosystem
│   └── shared/              # Cross-stack patterns
│
├── team-workflows/          # 👥 Team collaboration
│   ├── onboarding/          # New developer guides
│   ├── code-review/         # Review workflows
│   ├── architecture/        # ADR management
│   └── knowledge-sharing/   # Knowledge base
│
├── tools/                   # 🔧 Tooling
│   ├── cli/                 # Command-line interface
│   ├── vscode-extension/    # VS Code extension
│   └── web-dashboard/       # Web dashboard
│
├── mcp-configs/             # 🔌 MCP server configs
│   ├── enterprise/          # Jira, Azure DevOps, etc.
│   ├── java/                # Maven, Spring Initializr
│   └── dotnet/              # NuGet, Azure
│
└── examples/                # 📚 Example projects
    ├── java-microservices/
    └── dotnet-clean-architecture/
```

---

## 🧠 Memory Bank

The Memory Bank is a shared context system that lives in your repository:

```
your-project/
├── .memory-bank/
│   ├── project/
│   │   ├── context.md       # Project overview
│   │   ├── architecture.md  # Current architecture
│   │   ├── tech-stack.md    # Technology choices
│   │   └── glossary.md      # Business glossary
│   │
│   ├── decisions/           # Architecture Decision Records
│   │   ├── 001-database-choice.md
│   │   └── 002-api-versioning.md
│   │
│   ├── modules/             # Per-module context
│   │   ├── users/
│   │   ├── orders/
│   │   └── payments/
│   │
│   └── knowledge/           # Team knowledge base
│       ├── patterns.md
│       ├── antipatterns.md
│       └── troubleshooting.md
```

### How It Works

1. **Project Context**: Shared understanding of the project
2. **Module Context**: Specific knowledge per bounded context
3. **Decisions**: ADRs that explain why choices were made
4. **Knowledge**: Accumulated team learnings

GitHub Copilot reads this context through your `AGENTS.md` or `copilot-instructions.md`.

---

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g egce

# Or use npx
npx egce init
```

### Initialize a Project

```bash
# Initialize with Memory Bank
egce init

# Add Java/Spring stack
egce add-stack java-spring

# Or add .NET stack
egce add-stack dotnet
```

### Project Structure After Init

```
your-project/
├── .github/
│   ├── agents/              # Custom agents
│   ├── instructions/        # Coding standards
│   ├── prompts/             # Task prompts
│   └── copilot-instructions.md
│
├── .memory-bank/            # Team context
│   ├── project/
│   ├── decisions/
│   ├── modules/
│   └── knowledge/
│
└── AGENTS.md                # Root instructions
```

---

## ☕ Java/Spring Stack

Supported versions:
- **Java**: 17, 21, 25
- **Spring Boot**: 3.5.x (LTS), 4.0.x (latest)

### Included Agents

| Agent | Description |
|-------|-------------|
| `spring-architect` | System design and architecture |
| `jpa-specialist` | JPA/Hibernate optimization |
| `spring-security-expert` | Security configuration |
| `spring-cloud-expert` | Microservices patterns |

### Key Instructions

- `spring-boot-4.instructions.md` - Spring Boot 4.x patterns
- `spring-data-jpa.instructions.md` - JPA best practices
- `hexagonal-architecture.instructions.md` - Clean architecture
- `virtual-threads.instructions.md` - Java 21+ concurrency

---

## 🔷 .NET Stack

Supported versions:
- **.NET**: 8 (LTS), 9
- **C#**: 12

### Included Agents

| Agent | Description |
|-------|-------------|
| `dotnet-architect` | System design and architecture |
| `ef-core-specialist` | Entity Framework optimization |
| `aspnet-security-expert` | Security configuration |
| `minimal-apis-expert` | Minimal APIs patterns |

### Key Instructions

- `dotnet-9-features.instructions.md` - .NET 9 patterns
- `ef-core-8.instructions.md` - EF Core best practices
- `clean-architecture.instructions.md` - Clean architecture
- `aspire.instructions.md` - .NET Aspire integration

---

## 🔌 Enterprise MCP Configurations

Pre-configured MCP servers for enterprise tools:

| MCP Server | Tools |
|------------|-------|
| **Atlassian Rovo** | Jira, Confluence, Compass |
| **Azure DevOps** | Work items, PRs, pipelines, wiki |
| **GitHub** | Repos, issues, PRs, Actions |
| **SonarQube** | Quality gates, code analysis |

### Configuration

```json
// .vscode/mcp.json
{
  "servers": {
    "atlassian": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-atlassian"]
    },
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"]
    }
  }
}
```

---

## 🔧 Tools

### CLI

```bash
# Initialize project
egce init

# Memory Bank commands
egce memory init          # Initialize memory bank
egce memory validate      # Validate structure
egce memory sync          # Sync with remote

# Stack commands
egce add-stack java-spring
egce add-stack dotnet

# Migration
egce migrate --from claude-code
```

### VS Code Extension

- Tree view of Memory Bank
- Context editor
- Agent selector
- Quick commands

### Web Dashboard

- Visual Memory Bank explorer
- ADR timeline
- Knowledge base search
- Team activity feed

---

## 👥 Team Workflows

### Onboarding

New developers get up to speed quickly:

```bash
# In VS Code with Copilot
@workspace /onboard-developer

# Copilot reads the Memory Bank and guides the new dev
```

### Code Review

Consistent reviews across the team:

```bash
@workspace /review-pr #123
```

### Architecture Decisions

Document decisions as ADRs:

```bash
@workspace /document-decision "Why we chose PostgreSQL"
```

---

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [Memory Bank Guide](docs/memory-bank-guide.md)
- [Team Setup](docs/team-setup.md)
- [Java/Spring Guide](docs/java-spring-guide.md)
- [.NET Guide](docs/dotnet-guide.md)
- [MCP Configuration](docs/mcp-configuration.md)
- [Migration from Claude Code](docs/migration-from-claude.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- Additional language/framework stacks
- New agents and prompts
- MCP server configurations
- Documentation improvements
- VS Code extension features

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Inspired by [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [awesome-copilot](https://github.com/github/awesome-copilot) for patterns
- GitHub Copilot team for MCP support

---

**Built with ❤️ for enterprise development teams.**
