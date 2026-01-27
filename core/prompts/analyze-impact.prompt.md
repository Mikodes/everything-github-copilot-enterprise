---
name: analyze-impact
description: Analyze the impact of a proposed change across the codebase and team
---

# Analyze Impact

Analyze the potential impact of a proposed change on the codebase, team, and system.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Understand the current architecture
3. Identify affected modules

## Input

```
Change Description: {description of the proposed change}
Affected Area: {module, service, or component being changed}
Change Type: {feature | refactoring | dependency-update | architecture | breaking-change}
```

## Analysis Process

### 1. Code Impact Analysis

Analyze the following:

- **Direct Dependencies**: What directly depends on the changed code?
- **Indirect Dependencies**: What transitively depends on changed code?
- **API Changes**: Are there contract changes?
- **Database Changes**: Schema migrations needed?
- **Configuration Changes**: New config values required?

### 2. Module Impact Assessment

For each affected module, determine:

| Module | Impact Level | Changes Needed | Risk |
|--------|--------------|----------------|------|
| {module} | High/Med/Low | {description} | {risk level} |

### 3. Integration Points

Identify affected integration points:

- Internal service calls
- External API consumers
- Event publishers/subscribers
- Shared libraries

### 4. Team Impact

- Which teams need to be involved?
- What coordination is required?
- Are there skill gaps to address?
- Timeline implications?

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {risk} | Low/Med/High | Low/Med/High | {mitigation strategy} |

## Output Format

```markdown
## Impact Analysis: {Change Title}

**Date**: {date}
**Analyst**: {name}
**Change Type**: {type}

---

### Executive Summary

{2-3 sentence summary of the impact}

---

### Code Impact

#### Direct Impact
- {List of directly affected files/modules}

#### Indirect Impact
- {List of transitively affected areas}

#### API/Contract Changes
- {List of API changes}

---

### Module Impact Matrix

| Module | Impact | Effort | Owner |
|--------|--------|--------|-------|
| {module} | High/Med/Low | {estimate} | {team} |

---

### Dependencies

#### Upstream (things we depend on)
- {dependency}: {impact description}

#### Downstream (things that depend on us)
- {dependent}: {impact description}

---

### Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| {risk} | {1-5} | {1-5} | {L*I} | {strategy} |

**Overall Risk Level**: {Low/Medium/High/Critical}

---

### Team Coordination

| Team | Involvement | Action Required |
|------|-------------|-----------------|
| {team} | {level} | {action} |

---

### Recommendations

1. **Do Before**: {pre-requisites}
2. **Implementation Order**: {sequence}
3. **Rollback Plan**: {approach}
4. **Monitoring**: {what to watch}

---

### Memory Bank Updates Needed

- [ ] Update {module} context
- [ ] Create ADR for {decision}
- [ ] Add to knowledge base: {topic}

---

### Next Steps

1. {action item}
2. {action item}
3. {action item}
```

## Example Usage

**User**: Analyze the impact of upgrading Spring Boot from 3.1 to 3.2

**Response**: [Detailed impact analysis following the format above, including:
- All modules using Spring Boot features
- Configuration changes needed
- Deprecated API updates required
- Testing requirements
- Rollback considerations]
