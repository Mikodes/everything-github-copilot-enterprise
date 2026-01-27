---
name: document-decision
description: Create an Architecture Decision Record (ADR) for a technical decision
---

# Document Decision

Help document a technical decision as an Architecture Decision Record (ADR) for the Memory Bank.

## Context Required

Before documenting:
1. Understand the decision context
2. Review existing ADRs in `.memory-bank/decisions/`
3. Check project context for constraints
4. Identify stakeholders

## Input

```
Decision Topic: {what decision needs to be documented}
Context: {why this decision is being made}
Options Considered: {alternatives that were evaluated}
Chosen Option: {what was decided}
Rationale: {why this option was chosen}
```

## Documentation Process

### 1. Gather Information

- What problem are we solving?
- What constraints exist?
- Who are the stakeholders?
- What options were considered?
- What are the trade-offs?

### 2. Validate Decision Scope

Is this ADR-worthy? ✅ Yes if:
- Significant architectural impact
- Affects multiple teams/modules
- Difficult to reverse
- Important trade-offs involved

❌ No if:
- Implementation detail
- Easily reversible
- Limited scope
- Standard practice

### 3. Generate Next ADR ID

Check existing ADRs and use next sequential number:
`ADR-{XXXX}-{short-title}.md`

### 4. Draft the ADR

## Output Format

```markdown
# ADR-{XXXX}: {Title}

- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: {YYYY-MM-DD}
- **Deciders**: {names/roles}
- **Consulted**: {who was consulted}
- **Informed**: {who needs to know}

---

## Context

{The situation that is motivating this decision. What forces are at play?}

### Problem Statement

{Specific problem we're solving}

### Constraints

- {Constraint 1}
- {Constraint 2}
- {Constraint 3}

### Assumptions

- {Assumption 1}
- {Assumption 2}

---

## Decision

**We will {clear statement of the decision}.**

### Details

{Specifics of how this will be implemented}

---

## Rationale

{Why this option was chosen over others}

### Key Factors

1. {Factor 1 and why it matters}
2. {Factor 2 and why it matters}
3. {Factor 3 and why it matters}

---

## Alternatives Considered

### Option 1: {Name}

**Description**: {What this option is}

**Pros**:
- {Pro 1}
- {Pro 2}

**Cons**:
- {Con 1}
- {Con 2}

**Why Not Chosen**: {Reason for rejection}

### Option 2: {Name}

**Description**: {What this option is}

**Pros**:
- {Pro 1}
- {Pro 2}

**Cons**:
- {Con 1}
- {Con 2}

**Why Not Chosen**: {Reason for rejection}

### Option 3 (Chosen): {Name}

**Description**: {What this option is}

**Pros**:
- {Pro 1}
- {Pro 2}

**Cons**:
- {Con 1}
- {Con 2}

**Why Chosen**: {Why this is the best fit}

---

## Consequences

### Positive

- {Benefit 1}
- {Benefit 2}
- {Benefit 3}

### Negative

- {Drawback 1}
- {Drawback 2}

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {Risk 1} | Low/Med/High | Low/Med/High | {Mitigation} |
| {Risk 2} | Low/Med/High | Low/Med/High | {Mitigation} |

---

## Implementation

### Effort Estimate
{trivial | small | medium | large | epic}

### Timeline
{Expected timeline}

### Tasks

- [ ] {Task 1}
- [ ] {Task 2}
- [ ] {Task 3}

### Affected Modules

- {Module 1}: {How it's affected}
- {Module 2}: {How it's affected}

---

## Validation

### Success Criteria

1. {How we know this worked}
2. {Measurable outcome}

### Metrics

| Metric | Target | Current |
|--------|--------|---------|
| {Metric} | {Target value} | {Current value} |

### Review Date

{When to revisit this decision}

---

## Related

### Related ADRs
- [ADR-{XXXX}](./ADR-{XXXX}.md) - {Title}

### Related Modules
- {Module 1}
- {Module 2}

### References
- [{Reference title}]({URL})

---

## Notes

{Any additional notes}
```

## Example Usage

**User**: Document our decision to use PostgreSQL instead of MongoDB for the order service

**Response**: [Complete ADR with context about the decision, comparison of PostgreSQL vs MongoDB for this use case, trade-off analysis, implementation considerations, and validation criteria]
