---
name: review-pr
description: Comprehensive pull request review following team standards from Memory Bank
---

# Review Pull Request

Perform a thorough code review of a pull request following team standards and best practices.

## Context Required

Before reviewing:
1. Load project context from `.memory-bank/project/context.md`
2. Check relevant module context from `.memory-bank/modules/{module}/context.md`
3. Review team patterns from `.memory-bank/knowledge/patterns.md`
4. Check anti-patterns from `.memory-bank/knowledge/antipatterns.md`

## Input

```
PR Title: {title}
PR Description: {description}
Files Changed: {list of files or diff}
Related Issue: {issue number if any}
```

## Review Process

### Phase 1: Understand the Change

1. Read PR description and linked issues
2. Understand the "why" behind the change
3. Check against requirements
4. Review Memory Bank for context

### Phase 2: Review Code

Apply the code review checklist:

#### Correctness
- Does it work as intended?
- Are edge cases handled?
- Is error handling appropriate?

#### Security
- Any security vulnerabilities?
- Input validation present?
- Authorization checks in place?

#### Performance
- Any performance concerns?
- Database queries efficient?
- Caching considerations?

#### Quality
- Is code readable?
- Are names descriptive?
- Is complexity reasonable?

#### Testing
- Are there adequate tests?
- Do tests cover edge cases?
- Are tests meaningful?

### Phase 3: Compile Findings

Categorize issues by severity:
- 🔴 **Critical**: Must fix before merge
- 🟠 **Important**: Should fix
- 🟡 **Suggestion**: Nice to have
- 💚 **Praise**: Good work!

## Output Format

```markdown
## Code Review: {PR Title}

**Reviewer**: {name}
**Date**: {date}
**Decision**: Approve | Request Changes | Comment

---

### Summary

{2-3 sentence overview of the review}

**Overall Assessment**: {Good | Acceptable | Needs Work}

---

### 🔴 Critical Issues

#### [Issue Title]
**File**: `{path}:{line}`
**Category**: Security | Correctness | Breaking Change

**Problem**:
{Description of the issue}

**Why It Matters**:
{Explanation of impact}

**Suggested Fix**:
```{language}
// Suggested code
```

**Reference**: [Memory Bank Pattern/Standard if applicable]

---

### 🟠 Important Issues

[Same format as critical]

---

### 🟡 Suggestions

[Lighter format, brief descriptions]

---

### 💚 What's Done Well

- {Positive observation 1}
- {Positive observation 2}
- {Positive observation 3}

---

### Review Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅/⚠️/❌ | {notes} |
| Security | ✅/⚠️/❌ | {notes} |
| Performance | ✅/⚠️/❌ | {notes} |
| Testing | ✅/⚠️/❌ | {notes} |
| Code Quality | ✅/⚠️/❌ | {notes} |
| Documentation | ✅/⚠️/❌ | {notes} |

---

### Testing Verification

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing performed
- [ ] Edge cases tested

---

### Memory Bank Observations

{Any patterns worth documenting, standards to update, or knowledge to capture}

---

### Questions for Author

1. {Question about design decision}
2. {Clarification needed}
```

## Review Comment Templates

### Security Issue
```
🔴 **[Security]** {Title}

This code is vulnerable to {vulnerability type}.

**Impact**: {what could happen}

**Fix**:
```{lang}
// secure version
```

**Reference**: [OWASP/Memory Bank link]
```

### Performance Concern
```
🟠 **[Performance]** {Title}

This could cause {performance issue}.

**Suggestion**: {alternative approach}

**Expected Improvement**: {estimate}
```

### Code Quality
```
🟡 **[Quality]** {Title}

Consider {improvement} for better {readability/maintainability}.

Per our [coding standards](.memory-bank/...), we prefer...
```

## Example Usage

**User**: Review this PR that adds user authentication

**Response**: [Comprehensive review following the format, with specific line-by-line feedback, security considerations for auth, test coverage assessment, and alignment with team standards from Memory Bank]
