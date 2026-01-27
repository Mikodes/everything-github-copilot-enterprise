---
name: estimate-task
description: Provide effort estimates for development tasks with complexity analysis
---

# Estimate Task

Help estimate the effort required for a development task by analyzing complexity, dependencies, and risks.

## Context Required

Before estimating:
1. Understand the project structure from Memory Bank
2. Check module complexity from module contexts
3. Review team velocity if available
4. Identify similar past work

## Input

```
Task Description: {what needs to be done}
Acceptance Criteria: {definition of done}
Technical Context: {relevant technical details}
Dependencies: {blockers or prerequisites}
```

## Estimation Process

### 1. Understand the Task

- What is being built/changed?
- What are the acceptance criteria?
- What are the non-functional requirements?

### 2. Identify Components

Break down into estimable units:
- Frontend changes
- Backend changes
- Database changes
- Tests required
- Documentation
- DevOps/deployment

### 3. Analyze Complexity Factors

| Factor | Impact | Notes |
|--------|--------|-------|
| New vs Existing | Low/Med/High | Modifying existing is often harder |
| Dependencies | Low/Med/High | External dependencies add risk |
| Unknowns | Low/Med/High | Spike needed? |
| Testing | Low/Med/High | Complex scenarios? |
| Integration | Low/Med/High | Multiple systems? |

### 4. Apply Risk Multipliers

- Well-understood domain: 1x
- Some unknowns: 1.5x
- Many unknowns: 2x
- New technology: 2-3x

## Output Format

```markdown
## Task Estimate: {Task Title}

**Date**: {date}
**Estimator**: {name}

---

### Summary

| Metric | Value |
|--------|-------|
| **Estimated Effort** | {X story points / X days} |
| **Confidence** | High / Medium / Low |
| **Risk Level** | Low / Medium / High |

---

### Task Breakdown

| Component | Description | Effort | Confidence |
|-----------|-------------|--------|------------|
| {component} | {what's involved} | {estimate} | High/Med/Low |
| {component} | {what's involved} | {estimate} | High/Med/Low |
| **Total** | | **{total}** | |

---

### Detailed Breakdown

#### 1. {Component Name}
**Effort**: {estimate}

**Work Involved**:
- {Sub-task 1}
- {Sub-task 2}
- {Sub-task 3}

**Complexity Factors**:
- {Factor affecting this component}

**Assumptions**:
- {Assumption 1}
- {Assumption 2}

---

### Complexity Analysis

| Factor | Level | Justification |
|--------|-------|---------------|
| Technical Complexity | Low/Med/High | {reason} |
| Domain Complexity | Low/Med/High | {reason} |
| Dependencies | Low/Med/High | {reason} |
| Unknowns | Low/Med/High | {reason} |
| Integration Points | Low/Med/High | {reason} |

---

### Dependencies

#### Blockers
- [ ] {Dependency that must be done first}
- [ ] {Another blocker}

#### Parallel Work Possible
- {Work that can happen simultaneously}

---

### Risks

| Risk | Impact | Likelihood | Mitigation | Time Buffer |
|------|--------|------------|------------|-------------|
| {risk} | High/Med/Low | High/Med/Low | {mitigation} | {buffer} |

---

### Estimate Ranges

| Scenario | Effort | Probability |
|----------|--------|-------------|
| Best Case | {X} | 10% |
| Most Likely | {Y} | 70% |
| Worst Case | {Z} | 20% |

**Recommended Buffer**: {percentage} for unknowns

---

### Assumptions

1. {Assumption about requirements}
2. {Assumption about technical approach}
3. {Assumption about availability}

**If assumptions change, re-estimate.**

---

### Comparison to Similar Work

| Similar Task | Actual Effort | Relevance |
|--------------|---------------|-----------|
| {past task} | {actual} | High/Med/Low |

---

### Recommendations

#### Before Starting
1. {Spike needed?}
2. {Clarifications needed?}
3. {Dependencies to resolve?}

#### Approach
- {Suggested implementation approach}
- {Order of work}

---

### Confidence Assessment

**Why this confidence level**:
- {Reason for confidence/uncertainty}
- {What would increase confidence}

---

### Notes

{Additional context or caveats}
```

## Estimation Guidelines

### T-Shirt Sizes

| Size | Story Points | Typical Duration | Complexity |
|------|-------------|------------------|------------|
| XS | 1 | Hours | Trivial change |
| S | 2-3 | 1-2 days | Simple, well-understood |
| M | 5 | 3-5 days | Moderate complexity |
| L | 8 | 1-2 weeks | Complex, some unknowns |
| XL | 13+ | 2+ weeks | Very complex, break down |

### When to Break Down

Break down tasks if:
- Estimate > 8 story points
- Multiple people needed
- Multiple modules affected
- Significant unknowns

## Example Usage

**User**: Estimate adding OAuth2 authentication to our API

**Response**: [Detailed estimate breaking down the work into components like provider configuration, token handling, user integration, security review, tests, documentation, with complexity analysis and risk assessment]
