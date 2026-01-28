# Document Learning Prompt

## Purpose

Capture and document learnings from development activities, incidents, code reviews, or any experience that could benefit the team. Transform ephemeral knowledge into permanent, searchable wisdom.

---

## Prompt Template

```markdown
# Document Learning

## Learning Context

### Source of Learning
- [ ] Code development
- [ ] Code review
- [ ] Bug investigation
- [ ] Incident response
- [ ] Architecture discussion
- [ ] Technology exploration
- [ ] Pair programming
- [ ] Training/course
- [ ] External resource
- [ ] Other: ___________

### When did this happen?
[Date or time period]

### Who was involved?
[People who contributed to or witnessed this learning]

---

## The Learning

### What did you learn?
[Describe the insight, technique, or knowledge gained]

### Why is this valuable?
[Explain why others would benefit from knowing this]

### What problem does this solve?
[What challenge or question does this knowledge address?]

---

## Context

### What were you trying to do?
[The task or goal that led to this learning]

### What was the situation?
[Relevant background and circumstances]

### What did you try that didn't work?
[Failed approaches that are useful to know about]

### What ultimately worked?
[The successful approach or solution]

---

## Details

### Step-by-step (if applicable)
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Code example (if applicable)
```[language]
[Relevant code snippet]
```

### Commands or configuration (if applicable)
```
[Relevant commands or config]
```

---

## Caveats and Gotchas

### What could go wrong?
[Potential pitfalls or mistakes]

### What assumptions does this make?
[Conditions that need to be true]

### When does this NOT apply?
[Situations where this learning isn't relevant]

---

## Classification

### Type of knowledge
- [ ] How-to (procedural steps)
- [ ] Troubleshooting (problem/solution)
- [ ] Explanation (conceptual understanding)
- [ ] Best practice (recommended approach)
- [ ] Lesson learned (from experience)
- [ ] Reference (quick lookup)

### Related areas
- [ ] Development
- [ ] Testing
- [ ] Deployment
- [ ] Operations
- [ ] Security
- [ ] Performance
- [ ] Architecture
- [ ] Process

### Tags (comma-separated)
[e.g., typescript, debugging, api, caching]

---

## Generate Knowledge Entry

Please create a well-structured knowledge entry for the Memory Bank including:
1. Clear, searchable title
2. Concise summary
3. Detailed content appropriate for the knowledge type
4. Code examples where relevant
5. Related links and cross-references
6. Appropriate metadata and tags
```

---

## Example: Learning from Bug Investigation

```markdown
# Document Learning

## Learning Context

### Source of Learning
- [x] Bug investigation

### When did this happen?
January 20, 2024

### Who was involved?
Sarah Chen, Mike Johnson (debugging together)

---

## The Learning

### What did you learn?
JavaScript's `Array.prototype.sort()` modifies the original array in place AND returns the sorted array, which can lead to unexpected mutations when you think you're working with a copy.

### Why is this valuable?
This is a common source of subtle bugs, especially when working with React state or any immutable data patterns. Understanding this behavior prevents data corruption and unexpected UI updates.

### What problem does this solve?
Explains why data was appearing to change unexpectedly in our user list component, and provides the pattern to avoid this.

---

## Context

### What were you trying to do?
Implementing a sortable user list where users can sort by name or date.

### What was the situation?
The original user list (from API) was being modified even though we thought we were only sorting a display copy.

### What did you try that didn't work?
```javascript
// This looks like it creates a sorted copy, but it doesn't!
const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));
// 'users' is now also sorted - mutated!
```

### What ultimately worked?
```javascript
// Create actual copy FIRST, then sort
const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
// Original 'users' unchanged
```

---

## Details

### Code example
```typescript
// BAD: Mutates original array
function getSortedUsers(users: User[]): User[] {
  return users.sort((a, b) => a.name.localeCompare(b.name));
  // users is now mutated!
}

// GOOD: Creates new sorted array
function getSortedUsers(users: User[]): User[] {
  return [...users].sort((a, b) => a.name.localeCompare(b.name));
  // or: return users.slice().sort(...)
  // or: return Array.from(users).sort(...)
}

// ALSO GOOD: Use toSorted() (ES2023+)
function getSortedUsers(users: User[]): User[] {
  return users.toSorted((a, b) => a.name.localeCompare(b.name));
  // Built-in non-mutating sort
}
```

---

## Caveats and Gotchas

### What could go wrong?
- Same issue exists with `reverse()`, `splice()`, and other mutating array methods
- Shallow copies (spread, slice) only copy one level deep - nested objects still share references

### What assumptions does this make?
- Working with arrays that shouldn't be mutated
- Browser/Node supports ES6+ spread syntax

### When does this NOT apply?
- When you intentionally want to mutate the original array for performance
- When working with very large arrays where copying is expensive (consider memoization instead)

---

## Classification

### Type of knowledge
- [x] Best practice (recommended approach)

### Related areas
- [x] Development
- [x] Testing

### Tags
javascript, arrays, mutation, react, state-management, debugging
```

---

## Example: Learning from Incident

```markdown
# Document Learning

## Learning Context

### Source of Learning
- [x] Incident response

### When did this happen?
January 15, 2024 (INC-2024-012)

### Who was involved?
On-call team: Alex, Jordan; Supporting: Platform team

---

## The Learning

### What did you learn?
Connection pool exhaustion in our Node.js services can happen silently when database queries timeout but connections aren't properly released. Default timeout behavior varies by database driver.

### Why is this valuable?
This caused a 2-hour outage and could happen again without proper configuration and monitoring. Other teams using similar stacks should implement the same safeguards.

### What problem does this solve?
Prevents future outages from connection pool exhaustion and provides monitoring patterns to detect it before it causes problems.

---

## Context

### What were you trying to do?
Investigating why the API stopped responding to all requests.

### What was the situation?
API servers reported healthy but all requests were hanging. No error logs initially. Eventually saw "connection pool exhausted" errors.

### What did you try that didn't work?
- Restarting individual pods (helped temporarily, then failed again)
- Increasing pool size (delayed but didn't prevent the issue)
- Looking for error logs (nothing until pool fully exhausted)

### What ultimately worked?
1. Configured explicit query timeouts
2. Added pool exhaustion monitoring
3. Implemented connection release on timeout
4. Added circuit breaker for database operations

---

## Details

### Configuration that prevents this
```typescript
// database.config.ts
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 5000, // Timeout waiting for connection

  // CRITICAL: Query timeout configuration
  query_timeout: 10000,       // Kill queries after 10s
  statement_timeout: 10000,   // PostgreSQL server-side timeout
});

// Ensure connections are released on timeout
pool.on('error', (err, client) => {
  logger.error('Unexpected pool error', err);
  client.release(true); // Force release
});
```

### Monitoring to add
```typescript
// Monitor pool health
setInterval(() => {
  const { totalCount, idleCount, waitingCount } = pool;
  metrics.gauge('db.pool.total', totalCount);
  metrics.gauge('db.pool.idle', idleCount);
  metrics.gauge('db.pool.waiting', waitingCount);

  // Alert if waiting > 0 for extended period
  if (waitingCount > 0) {
    logger.warn('Connections waiting for pool', { waitingCount });
  }
}, 5000);
```

---

## Caveats and Gotchas

### What could go wrong?
- Query timeouts will fail legitimate long-running queries
- Need to identify and optimize slow queries, not just timeout them
- Different for read replicas vs primary

### What assumptions does this make?
- Using node-postgres (pg) driver
- Queries should complete in < 10 seconds
- Have metrics infrastructure available

### When does this NOT apply?
- Batch processing jobs with legitimately long queries
- Analytics queries (should use separate connection pool)

---

## Classification

### Type of knowledge
- [x] Troubleshooting (problem/solution)
- [x] Lesson learned (from experience)

### Related areas
- [x] Development
- [x] Operations
- [x] Performance

### Tags
database, postgresql, connection-pool, node.js, incident, monitoring, timeout
```

---

## Tips for Effective Learning Documentation

### Capture Immediately
```yaml
why: "Details fade quickly"
how:
  - Take notes during the experience
  - Screenshot relevant information
  - Save code snippets that worked
  - Record the sequence of events
```

### Be Specific
```yaml
avoid: "The database was slow"
prefer: "Queries to the users table took >5s due to missing index on email column"

avoid: "We fixed the bug"
prefer: "Changed from Array.sort() to [...array].sort() to prevent mutation"
```

### Include Failed Attempts
```yaml
why: "What didn't work is often as valuable as what did"
value:
  - Saves others from trying the same things
  - Shows the investigation process
  - Provides debugging context
```

### Think About Searchability
```yaml
title: "Use terms people would search for"
tags: "Include synonyms and related concepts"
content: "Include error messages verbatim"
```

### Connect to Context
```yaml
links:
  - Related Memory Bank entries
  - Relevant ADRs
  - Source incident or ticket
  - External documentation
```

---

*Documenting learnings multiplies their value. What you learned once can help the entire team forever.*
