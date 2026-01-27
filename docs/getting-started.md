# Getting Started with EGCE

Everything GitHub Copilot Enterprise (EGCE) helps enterprise teams maximize their GitHub Copilot experience with structured configurations, shared context, and team-aware AI assistance.

## Prerequisites

- Node.js 20 or higher
- Git
- GitHub Copilot license (individual or enterprise)

## Quick Start

### 1. Install EGCE CLI

```bash
npm install -g egce
```

Or use npx without installation:

```bash
npx egce --help
```

### 2. Initialize Your Project

Navigate to your project directory and run:

```bash
egce init
```

This will:
- Create the `.memory-bank/` directory for team context
- Set up `.github/` with Copilot configurations
- Add core agents and instructions
- Generate initial project context template

### 3. Verify Installation

```bash
egce doctor
```

This checks:
- Node.js version
- Git installation
- Memory Bank initialization
- GitHub directory structure

## Project Structure After Init

```
your-project/
├── .memory-bank/           # Team's shared knowledge
│   ├── project/
│   │   └── context.md      # Project context
│   ├── team/
│   │   └── context.md      # Team context
│   ├── modules/            # Module-specific contexts
│   ├── decisions/          # ADRs
│   └── knowledge/          # Patterns & best practices
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/             # Custom agents
│   ├── prompts/            # Reusable prompts
│   └── copilot-instructions/
└── ...your code
```

## Configuration Options

### Technology Stack

Add stack-specific configurations:

```bash
# Java/Spring
egce add-stack java-spring --version 3.2

# .NET
egce add-stack dotnet --version 8
```

### Memory Bank Only

If you just want the Memory Bank without other configs:

```bash
egce memory init
```

## Next Steps

1. **Fill in your project context**: Edit `.memory-bank/project/context.md`
2. **Add team information**: Edit `.memory-bank/team/context.md`
3. **Document your modules**: Run `egce memory add-module <name>`
4. **Record decisions**: Run `egce memory add-decision "Decision Title"`

## Learn More

- [Memory Bank Guide](./memory-bank-guide.md) - Deep dive into Memory Bank
- [Team Setup Guide](./team-setup.md) - Setting up for your team
- [CLI Reference](./cli-reference.md) - Full command documentation

## Common Issues

### Permission Denied

If you get permission errors with global install:

```bash
# Use npx instead
npx egce init

# Or fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Memory Bank Not Found

If Copilot can't find your Memory Bank:

1. Ensure `.memory-bank/` is in your project root
2. Check that files have valid frontmatter
3. Run `egce memory validate` to check structure

### Agents Not Loading

Verify your agent files:

1. Are in `.github/agents/`
2. Have `.agent.md` extension
3. Have valid frontmatter with `name` and `description`

## Getting Help

- **Documentation**: Check the `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/your-org/egce/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/egce/discussions)

## Example Usage

### Initialize a Spring Boot Project

```bash
# Create and enter project directory
mkdir my-spring-app && cd my-spring-app
git init

# Initialize with Spring stack
egce init --stack java-spring

# Add Spring Boot 3.2 specific instructions
egce add-stack java-spring --version 3.2

# Create initial module context
egce memory add-module order-service
egce memory add-module user-service

# Record initial architecture decision
egce memory add-decision "Use hexagonal architecture"

# Verify everything
egce validate
```

### Initialize a .NET Project

```bash
# Initialize with .NET stack
egce init --stack dotnet

# Add .NET 8 specific instructions
egce add-stack dotnet --version 8

# Create module contexts
egce memory add-module WebApi
egce memory add-module Domain
egce memory add-module Infrastructure
```

## What's Next?

After initialization, your GitHub Copilot will:

1. **Read your context** from the Memory Bank
2. **Follow your standards** from instructions
3. **Use your patterns** from the knowledge base
4. **Respect your decisions** documented in ADRs

Start coding and watch Copilot provide context-aware suggestions!
