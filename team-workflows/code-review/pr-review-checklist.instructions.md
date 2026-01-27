# PR Review Checklist Instructions

## Purpose

Provide a comprehensive checklist for conducting thorough, consistent code reviews. This checklist ensures all aspects of a pull request are evaluated while maintaining team standards and quality expectations.

---

## Quick Reference Checklist

```markdown
## PR Review Checklist

### Before Reviewing
- [ ] Read PR description and linked ticket
- [ ] Understand the context and requirements
- [ ] Check Memory Bank for relevant context
- [ ] Note any relevant ADRs

### Code Quality
- [ ] Logic is correct and handles edge cases
- [ ] Error handling is appropriate
- [ ] No obvious bugs or issues
- [ ] Code is readable and self-documenting
- [ ] Functions/methods are focused (single responsibility)
- [ ] No code duplication (DRY principle)
- [ ] Appropriate abstraction level

### Standards Compliance
- [ ] Follows team coding conventions
- [ ] Naming is clear and consistent
- [ ] File organization matches project structure
- [ ] Import ordering is correct
- [ ] No linting errors or warnings

### Security
- [ ] No hardcoded credentials or secrets
- [ ] Input validation present
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Authentication/authorization properly implemented
- [ ] Sensitive data handled securely

### Performance
- [ ] No N+1 query problems
- [ ] Appropriate caching considerations
- [ ] No memory leaks
- [ ] Efficient algorithms used
- [ ] Database queries optimized

### Testing
- [ ] Unit tests for new/changed code
- [ ] Edge cases covered in tests
- [ ] Tests are readable and maintainable
- [ ] Integration tests if needed
- [ ] All tests passing

### Documentation
- [ ] Code comments where needed
- [ ] Public APIs documented
- [ ] README updated if needed
- [ ] Memory Bank updated if significant

### Final Check
- [ ] PR is focused and appropriately sized
- [ ] Commits are logical and well-messaged
- [ ] No unrelated changes included
- [ ] CI/CD pipeline passing
```

---

## Detailed Review Criteria

### Code Correctness

#### Logic Review
```yaml
verify:
  - Algorithm correctness
  - Boundary conditions
  - Null/undefined handling
  - Race conditions
  - State management
  - Error propagation

questions:
  - Does this do what it claims?
  - What happens with edge cases?
  - Are assumptions documented?
  - Is the happy path clear?
  - Are error paths handled?
```

#### Error Handling
```yaml
check:
  - Errors caught at appropriate level
  - User-friendly error messages
  - Errors logged for debugging
  - Graceful degradation
  - Recovery mechanisms

patterns:
  good:
    - Try-catch with specific errors
    - Error boundaries (React)
    - Fallback behaviors
    - Retry logic where appropriate

  avoid:
    - Empty catch blocks
    - Swallowing errors silently
    - Generic error messages
    - Exposing internal errors to users
```

### Code Quality

#### Readability
```yaml
evaluate:
  - Can you understand it quickly?
  - Are names self-explanatory?
  - Is the flow clear?
  - Are complex parts commented?
  - Is formatting consistent?

red_flags:
  - Single-letter variables (except loops)
  - Deep nesting (>3 levels)
  - Long functions (>50 lines)
  - Magic numbers/strings
  - Clever but unclear code
```

#### Maintainability
```yaml
assess:
  - Easy to modify?
  - Easy to test?
  - Clear dependencies?
  - Minimal coupling?
  - Good separation of concerns?

look_for:
  - Small, focused functions
  - Clear interfaces
  - Dependency injection
  - Configuration externalized
  - Consistent patterns
```

### Security Checklist

#### Critical Security Items
```yaml
always_check:
  authentication:
    - Proper token validation
    - Session management
    - Password handling (hashing)
    - Multi-factor if required

  authorization:
    - Access control verified
    - Role-based permissions
    - Resource ownership checks
    - Least privilege principle

  data_protection:
    - Encryption at rest
    - Encryption in transit
    - PII handling
    - Audit logging

  input_validation:
    - All inputs validated
    - Whitelist over blacklist
    - Type checking
    - Length limits
```

#### Common Vulnerabilities
```yaml
prevent:
  injection:
    - SQL: Use parameterized queries
    - Command: Avoid shell execution
    - LDAP: Escape special characters

  xss:
    - Encode output
    - Content Security Policy
    - HttpOnly cookies

  csrf:
    - CSRF tokens
    - SameSite cookies
    - Origin validation

  sensitive_data:
    - No secrets in code
    - No PII in logs
    - Secure configuration
```

### Performance Checklist

#### Database
```yaml
verify:
  - Queries use indexes
  - No SELECT *
  - Pagination for large results
  - Connection pooling used
  - N+1 queries avoided

tools:
  - Explain plans
  - Query analyzers
  - Performance tests
```

#### Application
```yaml
check:
  - Appropriate data structures
  - Caching strategy
  - Lazy loading where beneficial
  - Memory management
  - Async operations used correctly

red_flags:
  - Synchronous I/O in hot paths
  - Large objects in memory
  - Unbounded collections
  - Missing pagination
  - Blocking operations
```

### Testing Review

#### Test Quality
```yaml
evaluate:
  coverage:
    - Critical paths tested
    - Edge cases covered
    - Error scenarios tested
    - Integration points tested

  quality:
    - Tests are readable
    - Test names describe behavior
    - One assertion per test (ideally)
    - No test interdependencies
    - Fast execution

  patterns:
    - Arrange-Act-Assert
    - Given-When-Then
    - Proper mocking
    - Test data factories
```

#### Test Adequacy
```yaml
questions:
  - Would you be confident deploying this?
  - What could break that isn't tested?
  - Are the tests testing the right things?
  - Would tests catch regressions?
  - Are edge cases covered?
```

---

## Review by Change Type

### New Feature
```yaml
priority_checks:
  1: Requirements alignment
  2: Architectural fit
  3: Test coverage
  4: Security implications
  5: Performance at scale
  6: Documentation

questions:
  - Does this meet the acceptance criteria?
  - Is the approach scalable?
  - Are there security implications?
  - Is it properly documented?
  - Does it follow existing patterns?
```

### Bug Fix
```yaml
priority_checks:
  1: Root cause addressed
  2: Regression test added
  3: No side effects
  4: Minimal change scope
  5: Related issues considered

questions:
  - Is the root cause fixed (not just symptoms)?
  - Could this bug exist elsewhere?
  - Is there a regression test?
  - Are there any side effects?
  - Is the fix minimal and focused?
```

### Refactoring
```yaml
priority_checks:
  1: Behavior preserved
  2: Tests still passing
  3: Readability improved
  4: No functional changes mixed in
  5: Clear motivation

questions:
  - Is behavior exactly preserved?
  - Are all tests still green?
  - Is this actually an improvement?
  - Is the scope appropriate?
  - Should this be split into smaller PRs?
```

### Performance Fix
```yaml
priority_checks:
  1: Measurable improvement
  2: No regression
  3: Benchmarks included
  4: Edge cases still work
  5: Trade-offs documented

questions:
  - Is the improvement measured?
  - Are there benchmark results?
  - What are the trade-offs?
  - Does it work under load?
  - Is the complexity worth it?
```

---

## Providing Feedback

### Feedback Format
```yaml
structure:
  severity: "blocker | issue | suggestion | nit | praise"
  what: "What you observed"
  why: "Why it matters"
  how: "How to address it"
  reference: "Link to convention/doc if applicable"
```

### Examples

#### Blocker
```markdown
:stop_sign: **Blocker**: SQL Injection Vulnerability

**What**: User input is directly concatenated into SQL query on line 45.

**Why**: This allows attackers to execute arbitrary SQL, potentially exposing or deleting all data.

**How**: Use parameterized queries instead:
```typescript
// Instead of:
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// Use:
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [userId]);
```

**Reference**: See security-baseline.instructions.md
```

#### Issue
```markdown
:warning: **Issue**: Missing Error Handling

**What**: The API call on line 78 doesn't handle failure cases.

**Why**: If the API fails, this will throw an unhandled exception and crash the request.

**How**: Add try-catch with appropriate error handling:
```typescript
try {
  const data = await fetchUserData(userId);
  return data;
} catch (error) {
  logger.error('Failed to fetch user data', { userId, error });
  throw new UserDataFetchError('Unable to load user data');
}
```
```

#### Suggestion
```markdown
:bulb: **Suggestion**: Consider Using Early Return

**What**: The nested if-else on lines 23-45 is deeply nested.

**Why**: Early returns can make the code more readable and reduce nesting.

**How**:
```typescript
// Instead of:
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      // do something
    }
  }
}

// Consider:
if (!user) return null;
if (!user.isActive) return null;
if (!user.hasPermission) return null;
// do something
```
```

#### Nitpick
```markdown
:pencil2: **Nit**: Variable Naming

**What**: `d` on line 12 could be more descriptive.

**Suggestion**: Consider `userData` or `userDetails` for clarity.
```

#### Praise
```markdown
:star: **Nice**: Excellent Test Coverage

Really thorough test cases here! I especially like how you covered the edge case with empty arrays and the error scenarios. This gives me confidence in the implementation.
```

---

## Review Process

### Steps
```yaml
1_prepare:
  - Read PR description
  - Understand context
  - Check Memory Bank
  - Review related ADRs

2_high_level:
  - Assess overall approach
  - Check architecture fit
  - Verify scope

3_detailed:
  - Review each file
  - Check logic and correctness
  - Evaluate tests
  - Note issues

4_security_pass:
  - Dedicated security review
  - Check common vulnerabilities
  - Verify authentication/authorization

5_summarize:
  - Compile feedback
  - Prioritize issues
  - Make recommendation
```

### Time Guidelines
```yaml
targets:
  small_pr: "< 100 lines: 15-30 minutes"
  medium_pr: "100-400 lines: 30-60 minutes"
  large_pr: "400+ lines: 1-2 hours (consider requesting split)"

note: "Quality over speed - take the time needed"
```

---

## Special Considerations

### Reviewing Junior Developers
- Be encouraging and educational
- Explain the "why" thoroughly
- Point to learning resources
- Focus on teaching moments
- Celebrate improvements

### Reviewing Senior Developers
- Trust their judgment more
- Focus on architecture and design
- Ask questions to understand choices
- Learn from their approaches
- Still check for blind spots

### Urgent/Hotfix PRs
- Focus on correctness and safety
- Accept temporary imperfection
- Ensure follow-up tickets created
- Quick turnaround is priority
- Document technical debt created

---

*Use this checklist consistently to ensure thorough, fair, and valuable code reviews that maintain quality while supporting team growth.*
