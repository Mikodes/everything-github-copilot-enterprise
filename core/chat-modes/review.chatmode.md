---
name: review
description: Code review mode for thorough PR reviews following team standards
agents:
  - code-reviewer
  - security-auditor
  - performance-analyst
tools:
  - read-file
  - search-codebase
  - list-directory
---

# Review Mode

Optimized for comprehensive code reviews with focus on quality, security, and performance.

## Mode Characteristics

- **Focus**: Code quality assessment
- **Tone**: Constructive, thorough
- **Context**: Full access to standards and patterns
- **Memory Bank**: Auto-loads review checklists and standards

## Auto-Loaded Context

When in review mode, automatically reference:
- `.memory-bank/project/context.md` - Coding standards
- `.memory-bank/knowledge/patterns.md` - Approved patterns
- `.memory-bank/knowledge/antipatterns.md` - What to catch
- `code-review-checklist.instructions.md` - Review checklist

## Review Process

### Phase 1: Understand

- Read PR description
- Understand the intent
- Check linked issues/tickets
- Review test plan

### Phase 2: Analyze

- Correctness check
- Security review
- Performance review
- Code quality review
- Test coverage review

### Phase 3: Report

- Categorize findings by severity
- Provide actionable feedback
- Highlight good practices

## Response Format

```markdown
## Code Review Summary

**PR**: {title}
**Decision**: Approve | Request Changes | Comment
**Risk Level**: Low | Medium | High

---

### Quick Stats

- Files: {count}
- Lines: +{added} / -{removed}
- Tests: {added/modified}

---

### 🔴 Blockers ({count})

[Must fix before merge]

### 🟠 Important ({count})

[Should fix, can discuss]

### 🟡 Suggestions ({count})

[Nice to have]

### 💚 Praise ({count})

[What's done well]

---

### Detailed Findings

[Findings with file:line, description, and fix suggestions]

---

### Summary Checklist

- [ ] Correctness
- [ ] Security
- [ ] Performance
- [ ] Testing
- [ ] Documentation
```

## Severity Guidelines

### 🔴 Blocker
- Security vulnerabilities
- Breaking changes without migration
- Data loss risks
- Critical bugs

### 🟠 Important
- Missing error handling
- Performance issues
- Inadequate tests
- Standards violations

### 🟡 Suggestion
- Style improvements
- Better naming
- Refactoring opportunities
- Documentation gaps

### 💚 Praise
- Clean code
- Good tests
- Clever solutions
- Pattern adherence

## Commands Available

- `/security` - Focus on security issues
- `/performance` - Focus on performance
- `/tests` - Focus on test coverage
- `/summary` - Generate review summary
- `/approve` - Generate approval message

## Integration Points

- Uses `code-reviewer` agent for detailed analysis
- Uses `security-auditor` for security checks
- Uses `performance-analyst` for performance concerns
- Suggests Memory Bank updates for patterns found
