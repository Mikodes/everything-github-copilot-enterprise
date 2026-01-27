---
name: update-memory-bank
description: Update Memory Bank with new knowledge, decisions, or context changes
---

# Update Memory Bank

Help maintain the Memory Bank by adding new knowledge, updating existing context, or documenting changes.

## Context Required

Before updating:
1. Understand the Memory Bank structure
2. Review existing content to avoid duplication
3. Identify the appropriate location for new content
4. Check related documents for cross-references

## Memory Bank Structure

```
.memory-bank/
├── project/
│   └── context.md           # Project-level context
├── team/
│   └── context.md           # Team context
├── modules/
│   └── {module}/
│       └── context.md       # Module-specific context
├── decisions/
│   └── ADR-XXXX-*.md        # Architecture decisions
└── knowledge/
    ├── patterns.md          # Approved patterns
    ├── antipatterns.md      # Things to avoid
    ├── troubleshooting/     # Problem solutions
    └── best-practices/      # Best practices
```

## Input

```
Update Type: {context | decision | knowledge | troubleshooting}
Content: {what needs to be added or updated}
Related To: {modules, decisions, or knowledge it relates to}
```

## Update Process

### 1. Determine Update Type

| Type | Location | When to Use |
|------|----------|-------------|
| Project Context | `.memory-bank/project/context.md` | Project-wide changes |
| Team Context | `.memory-bank/team/context.md` | Team structure changes |
| Module Context | `.memory-bank/modules/{module}/context.md` | Module changes |
| Decision (ADR) | `.memory-bank/decisions/` | Architectural decisions |
| Pattern | `.memory-bank/knowledge/patterns.md` | Reusable solutions |
| Anti-pattern | `.memory-bank/knowledge/antipatterns.md` | Things to avoid |
| Troubleshooting | `.memory-bank/knowledge/troubleshooting/` | Problem solutions |
| Best Practice | `.memory-bank/knowledge/best-practices/` | Recommended approaches |

### 2. Check for Existing Content

- Search for similar entries
- Check if update should be an edit or new entry
- Identify cross-references needed

### 3. Apply Update

- Use appropriate template
- Maintain consistent formatting
- Add metadata (date, author)
- Create cross-references

### 4. Verify Update

- Validate against schema if applicable
- Check links work
- Review for completeness

## Output Format

### For Context Updates

```markdown
## Memory Bank Update: {Title}

**Type**: Context Update
**Location**: `.memory-bank/{path}`
**Date**: {date}
**Author**: {name}

---

### Change Summary

{Brief description of what changed}

---

### Updated Content

[Show the updated section or full document]

---

### Cross-References Added

- Link to {related document 1}
- Link to {related document 2}

---

### Validation

- [ ] Content is accurate
- [ ] Formatting is consistent
- [ ] Links are valid
- [ ] No duplication
```

### For New Knowledge Entry

```markdown
## Memory Bank Update: New Knowledge Entry

**Type**: Knowledge Entry
**Location**: `.memory-bank/knowledge/{category}/{filename}.md`
**Date**: {date}
**Author**: {name}

---

### Entry Details

**ID**: KB-{XXXX}
**Title**: {title}
**Type**: {pattern | antipattern | troubleshooting | best-practice}
**Tags**: {tag1}, {tag2}, {tag3}

---

### Content

[Full knowledge entry using appropriate template]

---

### Related Items

- Related to ADR-{XXXX}
- Related to KB-{YYYY}
- Applies to modules: {module1}, {module2}

---

### Discoverability

**Search Keywords**: {keyword1}, {keyword2}
**Common Triggers**: {when would someone need this}
```

## Update Templates

### Pattern Entry

```markdown
# Pattern: {Pattern Name}

**ID**: KB-{XXXX}
**Type**: Pattern
**Tags**: {tags}

## Context

When to use this pattern.

## Problem

What problem this solves.

## Solution

The pattern implementation.

## Code Example

```{language}
// Example code
```

## Consequences

- Positive: {benefits}
- Negative: {trade-offs}

## Related

- {Related patterns or decisions}
```

### Troubleshooting Entry

```markdown
# Troubleshooting: {Problem Title}

**ID**: KB-{XXXX}
**Severity**: {Critical | High | Medium | Low}
**Tags**: {tags}

## Symptoms

- {Symptom 1}
- {Symptom 2}

## Cause

{Root cause explanation}

## Solution

{Step-by-step solution}

## Prevention

{How to prevent this}
```

### Module Context Update

```markdown
## Module Update: {Module Name}

### What Changed

{Description of change}

### Updated Sections

#### {Section Name}

{Updated content}

### Impact

- Affects: {other modules/systems}
- Requires: {any actions needed}
```

## Maintenance Tasks

### Regular Updates

- Review and update outdated content
- Archive deprecated entries
- Update statistics and metrics
- Check for broken links

### Quality Checks

- [ ] Content is current
- [ ] No contradictions with other entries
- [ ] Appropriate level of detail
- [ ] Actionable information

## Example Usage

**User**: Document the solution we found for the database connection timeout issue

**Response**: [Create a troubleshooting entry with symptoms, root cause, solution, and prevention, placed in the appropriate location with proper tagging and cross-references]
