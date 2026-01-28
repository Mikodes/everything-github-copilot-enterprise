# ADR Workflow Prompt

## Purpose

Guide the creation of Architecture Decision Records (ADRs) through a structured workflow that captures context, evaluates alternatives, and documents decisions for future reference.

---

## ADR Creation Workflow

### When to Create an ADR

```yaml
triggers:
  technology:
    - Adding new framework or library
    - Replacing existing technology
    - Adopting new patterns or practices

  architecture:
    - Changing system boundaries
    - Modifying data flow patterns
    - Altering integration approaches

  standards:
    - Establishing new coding standards
    - Defining API conventions
    - Setting security requirements

  reversibility:
    - Decisions difficult to reverse
    - Significant migration effort if changed
    - Long-term commitments

  impact:
    - Cross-team implications
    - Customer-facing changes
    - Performance/cost implications
```

---

## Prompt Template

```markdown
# ADR Creation Assistant

## Decision Context

### What needs to be decided?
[Describe the architectural decision that needs to be made]

### Why is this decision needed now?
[Explain the trigger or urgency]

### Who are the stakeholders?
[List teams or individuals affected]

### What are the constraints?
- Technical: [e.g., must work with existing stack]
- Business: [e.g., budget, timeline]
- Organizational: [e.g., team skills, support]

## Current State

### How does it work today?
[Describe the current architecture or approach]

### What problems exist?
[List issues driving this decision]

### What has been tried before?
[Any relevant history]

## Requirements

### Must Have
- [Critical requirement 1]
- [Critical requirement 2]

### Should Have
- [Important requirement 1]
- [Important requirement 2]

### Nice to Have
- [Optional requirement 1]

## Options Being Considered

### Option A: [Name]
**Description**: [Brief description]
**Pros**: [List advantages]
**Cons**: [List disadvantages]

### Option B: [Name]
**Description**: [Brief description]
**Pros**: [List advantages]
**Cons**: [List disadvantages]

### Option C: [Name]
**Description**: [Brief description]
**Pros**: [List advantages]
**Cons**: [List disadvantages]

## Generate ADR

Please create a complete ADR document with:
1. Clear title and status
2. Full context explanation
3. Decision statement
4. Detailed consequences (positive and negative)
5. Alternatives considered with reasoning for rejection
6. Implementation notes if relevant
```

---

## ADR Document Template

```markdown
# ADR-[NUMBER]: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded]

**Date**: [YYYY-MM-DD]
**Deciders**: [List of decision makers]
**Consulted**: [List of people consulted]
**Informed**: [List of people to inform]

---

## Context

### Background
[Explain the background and business context]

### Problem Statement
[Clear statement of the problem to solve]

### Drivers
- [Driver 1: Why this decision is needed]
- [Driver 2: What's pushing for change]
- [Driver 3: Business or technical trigger]

### Constraints
- [Constraint 1: Technical limitation]
- [Constraint 2: Business constraint]
- [Constraint 3: Time or resource constraint]

### Assumptions
- [Assumption 1: What we're assuming to be true]
- [Assumption 2: Dependencies we expect]

---

## Decision

**We will [decision statement].**

### Rationale
[Explain why this option was chosen over alternatives]

### Key Factors
1. [Factor 1 that influenced the decision]
2. [Factor 2 that influenced the decision]
3. [Factor 3 that influenced the decision]

---

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Negative
- [Drawback 1]
- [Drawback 2]
- [Trade-off 1]

### Neutral
- [Change that's neither good nor bad]
- [Side effect to be aware of]

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [How to mitigate] |
| [Risk 2] | [H/M/L] | [H/M/L] | [How to mitigate] |

---

## Alternatives Considered

### Alternative 1: [Name]

**Description**: [What this alternative involves]

**Pros**:
- [Advantage 1]
- [Advantage 2]

**Cons**:
- [Disadvantage 1]
- [Disadvantage 2]

**Why Not Chosen**: [Reason for rejection]

### Alternative 2: [Name]

**Description**: [What this alternative involves]

**Pros**:
- [Advantage 1]

**Cons**:
- [Disadvantage 1]

**Why Not Chosen**: [Reason for rejection]

### Do Nothing

**Description**: Maintain current state

**Why Not Chosen**: [Why this isn't acceptable]

---

## Implementation

### Approach
[High-level implementation approach]

### Phases
1. [Phase 1: Description and timeline]
2. [Phase 2: Description and timeline]
3. [Phase 3: Description and timeline]

### Dependencies
- [Dependency 1]
- [Dependency 2]

### Success Metrics
- [Metric 1: How we know this succeeded]
- [Metric 2: Measurable outcome]

---

## Related Decisions

- [ADR-XXX: Related decision]
- [ADR-YYY: Decision this supersedes]

---

## References

- [Link to relevant documentation]
- [Link to discussion thread]
- [Link to prototype or POC]

---

## Notes

[Any additional notes or context]

---

*Last updated: [Date]*
*Next review: [Date if applicable]*
```

---

## Example: Complete ADR

```markdown
# ADR-015: Adopt Redis for Session Management

## Status

**Accepted**

**Date**: 2024-01-15
**Deciders**: Tech Lead, Backend Team Lead, Security Lead
**Consulted**: DevOps, Platform Team
**Informed**: All Development Teams

---

## Context

### Background
Our application currently stores user sessions in-memory on each application server. As we scale to multiple instances behind a load balancer, users experience session loss when their requests are routed to different servers.

### Problem Statement
Session management doesn't work reliably in our multi-instance deployment, causing poor user experience and authentication issues.

### Drivers
- Scaling to 5+ application instances
- 15% of users reporting random logouts
- Need for session persistence across deployments
- Zero-downtime deployment requirements

### Constraints
- Must integrate with existing authentication system
- Sub-10ms latency requirement for session lookups
- HIPAA compliance requires encryption at rest
- Limited DevOps bandwidth for new infrastructure

### Assumptions
- Traffic will continue to grow 2x annually
- We'll remain on AWS infrastructure
- Session data size remains under 10KB per user

---

## Decision

**We will adopt Redis (AWS ElastiCache) for centralized session management.**

### Rationale
Redis provides the low-latency, distributed storage we need with mature tooling and easy AWS integration. Our team has Redis experience, and it's a proven solution for this exact use case.

### Key Factors
1. **Performance**: Sub-millisecond latency meets our requirements
2. **AWS Integration**: ElastiCache reduces operational burden
3. **Team Experience**: Backend team has prior Redis experience
4. **Ecosystem**: Excellent library support in our stack (Node.js)
5. **Cost**: Predictable pricing, reasonable for our scale

---

## Consequences

### Positive
- Reliable session management across all instances
- Support for horizontal scaling without session concerns
- Enable zero-downtime deployments
- Foundation for future caching needs
- Built-in TTL management for session expiry

### Negative
- Additional infrastructure component to maintain
- New failure mode (Redis unavailability)
- Monthly cost increase (~$150/month for r6g.medium)
- Need to handle Redis connection failures gracefully

### Neutral
- Session data format change (serialization to JSON)
- Deployment process update for Redis dependency

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Redis unavailability | Low | High | Multi-AZ deployment, circuit breaker |
| Data loss | Low | Medium | Enable AOF persistence |
| Latency spikes | Low | Medium | Connection pooling, monitoring |

---

## Alternatives Considered

### Alternative 1: Sticky Sessions (Load Balancer)

**Description**: Configure load balancer to route users to same server

**Pros**:
- No infrastructure changes
- Simple to implement

**Cons**:
- Uneven load distribution
- Session loss on server restart
- Doesn't support zero-downtime deploys

**Why Not Chosen**: Doesn't solve the deployment problem and creates scaling issues

### Alternative 2: Database Session Storage

**Description**: Store sessions in PostgreSQL

**Pros**:
- Uses existing infrastructure
- Strong consistency

**Cons**:
- Higher latency (5-10ms vs <1ms)
- Increased database load
- More complex queries

**Why Not Chosen**: Latency too high for session lookups on every request

### Alternative 3: JWT Tokens (Stateless)

**Description**: Move to stateless JWT-based authentication

**Pros**:
- No session storage needed
- Easier horizontal scaling

**Cons**:
- Can't revoke tokens easily
- Token size increases request payload
- Major auth system rewrite

**Why Not Chosen**: Too large a change; doesn't fit our revocation requirements

### Do Nothing

**Why Not Chosen**: Current issues are causing measurable user impact and blocking scaling plans

---

## Implementation

### Approach
Gradual migration with fallback to database sessions during transition

### Phases
1. **Week 1-2**: Set up ElastiCache cluster, implement Redis session store
2. **Week 3**: Deploy with feature flag, 10% traffic
3. **Week 4**: Gradual rollout to 100%, remove old session code

### Dependencies
- AWS ElastiCache provisioning (DevOps)
- VPC configuration for Redis access
- Monitoring dashboards (Platform)

### Success Metrics
- Zero session-related logout reports
- Session lookup latency < 5ms p99
- Successful zero-downtime deployment

---

## Related Decisions

- ADR-008: JWT for API authentication (complementary)
- ADR-003: PostgreSQL as primary database (this offloads session load)

---

## References

- [ElastiCache Best Practices](internal-wiki/elasticache)
- [Session Management RFC](internal-docs/rfc-session)
- [Spike: Redis POC Results](confluence/redis-poc)

---

*Last updated: 2024-01-15*
*Next review: 2024-07-15 (6 months)*
```

---

## ADR Lifecycle

```yaml
statuses:
  proposed:
    meaning: "Under discussion"
    actions: "Gather feedback, refine"

  accepted:
    meaning: "Decision made, implementation proceeds"
    actions: "Implement, update affected docs"

  deprecated:
    meaning: "No longer recommended"
    actions: "Document why, point to replacement"

  superseded:
    meaning: "Replaced by newer decision"
    actions: "Link to new ADR"

transitions:
  proposed -> accepted: "Stakeholder approval"
  proposed -> rejected: "Decision not to proceed"
  accepted -> deprecated: "Better approach found"
  accepted -> superseded: "New ADR replaces this"
```

---

## Best Practices

### Writing Good ADRs
```yaml
do:
  - Be concise but complete
  - Focus on the "why" not just "what"
  - Include rejected alternatives
  - Acknowledge trade-offs honestly
  - Set review dates for significant decisions

dont:
  - Write novels
  - Hide negative consequences
  - Skip the alternatives section
  - Use jargon without explanation
  - Make decisions without context
```

### Maintenance
```yaml
review_triggers:
  - Scheduled review date
  - Related system changes
  - Problems arising from decision
  - New alternatives available

update_guidelines:
  - Never delete history
  - Add notes for context changes
  - Update status appropriately
  - Link to related decisions
```

---

*ADRs are a critical part of architectural governance. They ensure decisions are made deliberately, documented clearly, and can be understood by future team members.*
