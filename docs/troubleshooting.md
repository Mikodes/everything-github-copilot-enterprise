# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with EGCE (Everything GitHub Copilot Enterprise).

## Quick Diagnostics

Run the doctor command to check your setup:

```bash
egce doctor
```

This will verify:
- Node.js version
- Git installation
- Memory Bank status
- GitHub configuration

---

## Common Issues

### Installation Issues

#### "command not found: egce"

**Cause:** EGCE is not installed globally or not in PATH.

**Solutions:**

1. Install globally:
   ```bash
   npm install -g egce
   ```

2. Or use npx:
   ```bash
   npx egce <command>
   ```

3. Check npm global path:
   ```bash
   npm config get prefix
   # Add /bin to your PATH if needed
   ```

#### "EACCES permission denied"

**Cause:** npm doesn't have permission to install globally.

**Solutions:**

1. Use a Node version manager (recommended):
   ```bash
   # With nvm
   nvm install 20
   nvm use 20
   npm install -g egce
   ```

2. Or fix npm permissions:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   # Add to ~/.bashrc or ~/.zshrc:
   export PATH=~/.npm-global/bin:$PATH
   ```

#### "Unsupported Node.js version"

**Cause:** Node.js version is below 20.0.0.

**Solution:**

Update Node.js:
```bash
# Using nvm
nvm install 20
nvm use 20

# Or download from nodejs.org
```

---

### Memory Bank Issues

#### "Memory Bank not initialized"

**Cause:** The `.memory-bank` directory doesn't exist.

**Solution:**

Initialize the Memory Bank:
```bash
egce init
# or
egce memory init
```

#### "Memory Bank already exists"

**Cause:** Trying to initialize when `.memory-bank` already exists.

**Solutions:**

1. Use force flag to reinitialize:
   ```bash
   egce init --force
   ```

2. Or remove existing and reinitialize:
   ```bash
   rm -rf .memory-bank
   egce init
   ```

#### "Required directory missing"

**Cause:** Memory Bank structure is incomplete.

**Solution:**

Reinitialize or create missing directories:
```bash
# Reinitialize
egce init --force

# Or create manually
mkdir -p .memory-bank/{project,team,modules,decisions,knowledge}
```

#### "Project context file missing"

**Cause:** `.memory-bank/project/context.md` doesn't exist.

**Solution:**

Create the file manually or reinitialize:
```bash
egce memory init --force
```

#### "Contains unresolved template variables"

**Cause:** Template variables like `{{project_name}}` haven't been replaced.

**Solution:**

Edit the file and replace template variables with actual values:
```bash
# Open and edit
vim .memory-bank/project/context.md

# Replace {{project_name}} with your actual project name
```

---

### Validation Issues

#### "Missing YAML frontmatter"

**Cause:** Markdown files don't have the required YAML header.

**Solution:**

Add frontmatter to the file:
```markdown
---
name: "My File"
description: "Description here"
lastUpdated: "2024-01-15"
---

# Content starts here
```

#### "Does not follow ADR naming convention"

**Cause:** Decision files don't match the pattern `ADR-XXXX-title.md`.

**Solution:**

Rename the file to match the convention:
```bash
# Correct format
mv decision.md ADR-0001-use-microservices.md
```

#### "Missing required section"

**Cause:** Agent or instruction files are missing required sections.

**Solution:**

Add the missing sections. For agents:
```markdown
## Role
[Agent's primary role]

## Responsibilities
- Responsibility 1
- Responsibility 2
```

---

### Migration Issues

#### "No Claude Code configuration found"

**Cause:** Migration couldn't find `CLAUDE.md`, `agents/`, `skills/`, or `commands/`.

**Solutions:**

1. Make sure you're in the correct directory:
   ```bash
   ls -la
   # Look for CLAUDE.md or .claude directory
   ```

2. Specify the path explicitly:
   ```bash
   egce migrate --path /path/to/claude/config
   ```

3. Check if files use different names:
   ```bash
   # Migration looks for:
   # - CLAUDE.md, claude.md, .claude/CLAUDE.md
   # - agents/, .claude/agents/, ai-agents/
   # - skills/, .claude/skills/
   # - commands/, .claude/commands/, prompts/
   ```

#### "Failed to parse CLAUDE.md"

**Cause:** The CLAUDE.md file has unexpected formatting.

**Solutions:**

1. Check for markdown syntax errors
2. Ensure headers use proper format:
   ```markdown
   # Main Title
   ## Section
   ### Subsection
   ```

3. Try with verbose output:
   ```bash
   EGCE_DEBUG=1 egce migrate
   ```

#### "Migration created empty files"

**Cause:** Parser couldn't extract content from your configuration.

**Solutions:**

1. Check migration warnings:
   ```bash
   egce migrate --dry-run
   ```

2. Review your source files for:
   - Proper markdown structure
   - Content under headers
   - Bullet points for lists

3. Manually transfer important content

---

### Stack Issues

#### "Unknown stack"

**Cause:** Specified stack is not supported.

**Solution:**

Use a supported stack:
```bash
# List available stacks
egce add-stack --help

# Currently supported:
egce add-stack java-spring
egce add-stack dotnet
```

#### "Stack files already exist"

**Cause:** Stack configuration was previously added.

**Solution:**

Use force flag to overwrite:
```bash
egce add-stack java-spring --force
```

---

### Performance Issues

#### "Command is slow"

**Cause:** Large number of files or slow disk.

**Solutions:**

1. Exclude unnecessary files:
   ```bash
   # Add to .gitignore
   node_modules/
   dist/
   build/
   ```

2. Run validation on specific components:
   ```bash
   egce validate --memory-bank  # Only validate Memory Bank
   ```

#### "Memory Bank export is large"

**Cause:** Many knowledge entries and decisions.

**Solutions:**

1. Export only what's needed:
   ```bash
   # Use the exported JSON and filter client-side
   egce memory export -o export.json
   ```

2. Archive old decisions:
   ```bash
   mkdir -p .memory-bank/decisions/archive
   mv .memory-bank/decisions/ADR-000*.md .memory-bank/decisions/archive/
   ```

---

## Debug Mode

Enable debug output for detailed information:

```bash
# Set environment variable
export EGCE_DEBUG=1
egce <command>

# Or inline
EGCE_DEBUG=1 egce validate
```

---

## Log Files

EGCE doesn't create log files by default. To capture output:

```bash
egce validate 2>&1 | tee egce.log
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOENT: no such file` | File doesn't exist | Check path and create if needed |
| `EISDIR: illegal operation` | Trying to read directory as file | Use correct path |
| `EPERM: operation not permitted` | Permission issue | Check file permissions |
| `SyntaxError: Unexpected token` | Invalid JSON/YAML | Fix syntax in config files |

---

## Getting Help

If you can't resolve an issue:

1. **Check existing issues:**
   https://github.com/exceptia/everything-github-copilot-enterprise/issues

2. **Create a new issue with:**
   - EGCE version (`egce --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Full error message
   - Steps to reproduce

3. **Include debug output:**
   ```bash
   EGCE_DEBUG=1 egce <command> 2>&1 | tee debug.log
   ```

---

## Reset Everything

If you need to start fresh:

```bash
# Remove all EGCE configurations
rm -rf .memory-bank
rm -rf core/agents core/instructions core/prompts
rm -rf stacks
rm -rf configs
rm -f AGENTS.md
rm -f .github/copilot-instructions.md

# Reinitialize
egce init
```

**Warning:** This will delete all your configurations. Back up important files first.
