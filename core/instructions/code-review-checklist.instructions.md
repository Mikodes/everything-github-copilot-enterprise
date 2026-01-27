---
applyTo: "**/*"
excludeAgent: ""
---

# Code Review Checklist

This checklist provides a systematic approach to code review. Use it to ensure consistent, thorough reviews that maintain code quality while respecting developer time.

## Review Mindset

### As a Reviewer

- **Assume Good Intent**: The author made their best effort
- **Be Constructive**: Offer solutions, not just criticism
- **Be Timely**: Review within 24 hours when possible
- **Be Thorough**: Don't just skim; understand the changes
- **Be Respectful**: Focus on code, not the person

### As an Author

- **Self-Review First**: Review your own code before requesting
- **Provide Context**: Explain what, why, and how to test
- **Be Receptive**: Feedback improves the code and your skills
- **Respond Promptly**: Don't let reviews stall

## Quick Checklist

### Before You Start

- [ ] Understand the purpose of the change
- [ ] Check related ticket/issue for requirements
- [ ] Review Memory Bank for relevant context

### Correctness

- [ ] Code does what it's supposed to do
- [ ] Logic is correct
- [ ] Edge cases are handled
- [ ] Error handling is appropriate

### Security

- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Authorization checks in place
- [ ] No injection vulnerabilities
- [ ] Sensitive data handled properly

### Testing

- [ ] Tests exist for new functionality
- [ ] Tests cover edge cases
- [ ] Tests are meaningful (not just for coverage)
- [ ] Tests pass

### Performance

- [ ] No obvious performance issues
- [ ] Database queries are efficient
- [ ] No N+1 query problems
- [ ] Appropriate caching considered

### Code Quality

- [ ] Code is readable
- [ ] Names are clear and descriptive
- [ ] No unnecessary complexity
- [ ] DRY principle followed
- [ ] SOLID principles applied where appropriate

### Documentation

- [ ] Public APIs are documented
- [ ] Complex logic is explained
- [ ] README updated if needed
- [ ] API docs updated if applicable

## Detailed Checklist by Category

### 1. Functionality

#### Does It Work?

```
[ ] Implements requirements correctly
[ ] Handles all specified scenarios
[ ] Edge cases considered:
    [ ] Empty inputs
    [ ] Null values
    [ ] Boundary values
    [ ] Maximum/minimum values
    [ ] Invalid inputs
[ ] Error messages are helpful
[ ] State changes are correct
```

#### Business Logic

```
[ ] Business rules implemented correctly
[ ] Domain terminology used consistently
[ ] Aligns with existing patterns in codebase
```

### 2. Security

#### Authentication & Authorization

```
[ ] Endpoints require authentication where needed
[ ] Authorization checks on all protected resources
[ ] No privilege escalation possible
[ ] Session handling is secure
```

#### Input Handling

```
[ ] All user input is validated
[ ] Parameterized queries used (no SQL injection)
[ ] Output is properly encoded (no XSS)
[ ] File uploads are validated
```

#### Sensitive Data

```
[ ] No secrets in code
[ ] PII is handled according to policy
[ ] Data encrypted where required
[ ] Sensitive data not logged
```

### 3. Testing

#### Test Coverage

```
[ ] New code has unit tests
[ ] Critical paths have integration tests
[ ] Tests cover happy path
[ ] Tests cover error cases
[ ] Tests cover edge cases
```

#### Test Quality

```
[ ] Tests are readable
[ ] Tests follow AAA pattern
[ ] Tests are isolated (no dependencies between tests)
[ ] Tests are deterministic (not flaky)
[ ] Test names describe behavior
```

### 4. Performance

#### Database

```
[ ] Queries are optimized
[ ] Appropriate indexes exist (or are suggested)
[ ] N+1 queries avoided
[ ] Large datasets paginated
[ ] Transactions are appropriate scope
```

#### Memory & Resources

```
[ ] No memory leaks (resources closed)
[ ] Collections sized appropriately
[ ] Large objects not held unnecessarily
[ ] Caching used where appropriate
```

#### Concurrency

```
[ ] Thread safety considered
[ ] Deadlocks not possible
[ ] Race conditions handled
[ ] Async operations used appropriately
```

### 5. Code Quality

#### Readability

```
[ ] Code is easy to understand
[ ] Variable/method names are clear
[ ] Functions are focused (single responsibility)
[ ] Complexity is manageable
[ ] Comments explain "why" not "what"
```

#### Maintainability

```
[ ] Code is modular
[ ] Dependencies are injected
[ ] Configuration externalized
[ ] Magic numbers/strings avoided
[ ] Duplication minimized
```

#### Consistency

```
[ ] Follows project coding standards
[ ] Consistent with existing codebase style
[ ] Naming conventions followed
[ ] File organization matches project structure
```

### 6. Error Handling

```
[ ] Errors are handled, not swallowed
[ ] Specific exceptions used (not generic)
[ ] Error messages are informative
[ ] Errors are logged appropriately
[ ] User-facing errors are friendly
[ ] System can recover from errors
```

### 7. Documentation

#### Code Documentation

```
[ ] Public APIs have documentation
[ ] Complex algorithms explained
[ ] Non-obvious code commented
[ ] TODO/FIXME comments have tickets
```

#### External Documentation

```
[ ] README updated if needed
[ ] API documentation current
[ ] Changelog updated for notable changes
[ ] Memory Bank updated if relevant
```

### 8. Architecture & Design

```
[ ] Follows project architecture patterns
[ ] Respects module boundaries
[ ] Dependencies flow correctly
[ ] No circular dependencies introduced
[ ] Changes are backward compatible (or migration provided)
```

## Review Comment Guide

### Severity Levels

| Prefix | Meaning | Action Required |
|--------|---------|-----------------|
| 🔴 **Blocker** | Must fix before merge | Yes |
| 🟠 **Important** | Should fix, may be deferred | Discuss |
| 🟡 **Suggestion** | Nice to have | No |
| 💭 **Question** | Clarification needed | Response |
| 💚 **Praise** | Good work! | None |

### Comment Format

```markdown
🟠 **[Category]** Brief description

File: `path/to/file.java:123`

Description of the issue and why it matters.

**Suggested fix:**
```java
// Code example
```

**Reference:** [Link to standard/pattern if applicable]
```

### Example Comments

#### Good Comment

```markdown
🟠 **[Security]** SQL Injection vulnerability

File: `UserRepository.java:45`

The query concatenates user input directly, which allows SQL injection.

**Suggested fix:**
```java
// Use parameterized query instead
@Query("SELECT u FROM User u WHERE u.email = :email")
User findByEmail(@Param("email") String email);
```

**Reference:** [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
```

#### Bad Comment

```markdown
This is wrong.
```

```markdown
I would have done it differently.
```

### When to Approve

✅ Approve when:
- All blockers resolved
- Important issues addressed or have plan
- Code is good enough, not perfect

❌ Don't block for:
- Style preferences not in standards
- Alternative approaches that are equally valid
- Perfect documentation

## After the Review

### Reviewer

- [ ] All comments addressed or acknowledged
- [ ] Tests still pass after changes
- [ ] Approve or request changes

### Author

- [ ] Respond to all comments
- [ ] Make requested changes
- [ ] Update tests if needed
- [ ] Request re-review if needed

## Memory Bank Integration

Reference Memory Bank during reviews:
- Check `.memory-bank/project/context.md` for standards
- Check `.memory-bank/knowledge/patterns.md` for approved patterns
- Check `.memory-bank/knowledge/antipatterns.md` for things to avoid
- Update Memory Bank if review reveals new knowledge
