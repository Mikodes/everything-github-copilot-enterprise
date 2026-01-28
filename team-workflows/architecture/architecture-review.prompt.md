# Architecture Review Prompt

## Purpose

Facilitate comprehensive architecture reviews for significant changes, new features, or system designs. This prompt guides the collection of information needed for thorough architectural evaluation.

---

## Prompt Template

```markdown
# Architecture Review Request

## Overview

### What is being reviewed?
[Brief description of the architecture, design, or change]

### Review Type
- [ ] New system/service design
- [ ] Significant feature addition
- [ ] Technology adoption
- [ ] Integration design
- [ ] Performance optimization
- [ ] Security enhancement
- [ ] Migration/refactoring

### Urgency
- [ ] Planning phase (time for iteration)
- [ ] Pre-implementation (decision needed soon)
- [ ] In-progress (need validation)
- [ ] Post-implementation (retrospective)

---

## Context

### Problem Statement
[What problem does this solve? What's the business need?]

### Current State
[How does the system work today? What's being changed?]

### Scope
[What's included? What's explicitly out of scope?]

### Stakeholders
| Role | Name | Interest |
|------|------|----------|
| [Role] | [Name] | [What they care about] |

### Constraints
- **Technical**: [e.g., must integrate with X, limited to Y]
- **Business**: [e.g., budget, timeline, compliance]
- **Organizational**: [e.g., team skills, support capacity]

---

## Proposed Design

### High-Level Architecture
[Describe or diagram the proposed architecture]

```
[ASCII diagram or description of component relationships]
```

### Key Components
| Component | Responsibility | Technology |
|-----------|---------------|------------|
| [Name] | [What it does] | [Tech stack] |

### Data Flow
[How does data move through the system?]

### Integration Points
| System | Type | Protocol | Purpose |
|--------|------|----------|---------|
| [System] | [Sync/Async] | [REST/gRPC/etc] | [Why] |

### Technology Choices
| Decision | Choice | Rationale |
|----------|--------|-----------|
| [What] | [Technology] | [Why chosen] |

---

## Quality Attribute Requirements

### Performance
- **Latency**: [Target response times]
- **Throughput**: [Requests/transactions per second]
- **Concurrency**: [Concurrent users/connections]

### Scalability
- **Current scale**: [Users, data volume, etc.]
- **Target scale**: [Where we need to be]
- **Growth rate**: [Expected growth]

### Availability
- **SLA target**: [99.9%, 99.99%, etc.]
- **Recovery time**: [RTO]
- **Data loss tolerance**: [RPO]

### Security
- **Authentication**: [How users are authenticated]
- **Authorization**: [How access is controlled]
- **Data protection**: [Encryption, compliance needs]

### Maintainability
- **Team expertise**: [Relevant skills]
- **Operational needs**: [Monitoring, debugging]
- **Documentation**: [What's needed]

---

## Risks and Concerns

### Known Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | [H/M/L] | [H/M/L] | [How to address] |

### Open Questions
1. [Question 1]
2. [Question 2]

### Assumptions
- [Assumption 1]
- [Assumption 2]

---

## Alternatives Considered

### Alternative 1: [Name]
**Description**: [Brief description]
**Why not chosen**: [Reasoning]

### Alternative 2: [Name]
**Description**: [Brief description]
**Why not chosen**: [Reasoning]

---

## Review Focus Areas

What aspects need the most attention?
- [ ] Overall architectural approach
- [ ] Technology choices
- [ ] Security considerations
- [ ] Performance/scalability
- [ ] Operational concerns
- [ ] Integration approach
- [ ] Data management
- [ ] Cost implications

---

## Supporting Materials

### Documents
- [Link to design doc]
- [Link to diagrams]
- [Link to prototypes]

### Related ADRs
- [ADR-XXX: Related decision]

### Memory Bank Context
- [Relevant module contexts]
- [Relevant knowledge entries]
```

---

## Review Response Template

```markdown
# Architecture Review: [Title]

## Reviewer Information
- **Reviewer**: [Name/Agent]
- **Date**: [YYYY-MM-DD]
- **Review Type**: [Initial/Follow-up/Final]

---

## Executive Summary

[2-3 sentence summary of the review findings and recommendation]

---

## Quality Attribute Assessment

### Performance
| Aspect | Assessment | Concerns | Recommendations |
|--------|------------|----------|-----------------|
| Latency | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Throughput | [Good/Concern/Unknown] | [Details] | [Suggestions] |

### Scalability
| Aspect | Assessment | Concerns | Recommendations |
|--------|------------|----------|-----------------|
| Horizontal | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Vertical | [Good/Concern/Unknown] | [Details] | [Suggestions] |

### Reliability
| Aspect | Assessment | Concerns | Recommendations |
|--------|------------|----------|-----------------|
| Fault Tolerance | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Recovery | [Good/Concern/Unknown] | [Details] | [Suggestions] |

### Security
| Aspect | Assessment | Concerns | Recommendations |
|--------|------------|----------|-----------------|
| Authentication | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Authorization | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Data Protection | [Good/Concern/Unknown] | [Details] | [Suggestions] |

### Maintainability
| Aspect | Assessment | Concerns | Recommendations |
|--------|------------|----------|-----------------|
| Complexity | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Testability | [Good/Concern/Unknown] | [Details] | [Suggestions] |
| Operability | [Good/Concern/Unknown] | [Details] | [Suggestions] |

---

## Detailed Findings

### Strengths
1. **[Strength 1]**: [Explanation]
2. **[Strength 2]**: [Explanation]

### Critical Issues
1. **[Issue 1]**: [Explanation and required action]
2. **[Issue 2]**: [Explanation and required action]

### Concerns
1. **[Concern 1]**: [Explanation and recommendation]
2. **[Concern 2]**: [Explanation and recommendation]

### Suggestions
1. **[Suggestion 1]**: [Explanation and benefit]
2. **[Suggestion 2]**: [Explanation and benefit]

---

## Risk Assessment

| Risk | Current Mitigation | Adequacy | Recommendation |
|------|-------------------|----------|----------------|
| [Risk 1] | [What's proposed] | [Adequate/Inadequate] | [Suggestion] |
| [Risk 2] | [What's proposed] | [Adequate/Inadequate] | [Suggestion] |

---

## Technology Assessment

| Technology | Fit | Concerns | Recommendation |
|------------|-----|----------|----------------|
| [Tech 1] | [Good/Acceptable/Poor] | [Details] | [Suggestion] |
| [Tech 2] | [Good/Acceptable/Poor] | [Details] | [Suggestion] |

### Tech Radar Alignment
- [Technology X] is in [Ring] - [Appropriate/Needs Exception]

---

## Open Questions

### Resolved
1. **Q**: [Question]
   **A**: [Answer found during review]

### Remaining
1. [Question needing stakeholder input]
2. [Question requiring further investigation]

---

## Recommendations

### Required Actions
1. [Action 1] - **Priority**: High
2. [Action 2] - **Priority**: High

### Suggested Improvements
1. [Improvement 1] - **Priority**: Medium
2. [Improvement 2] - **Priority**: Low

### Follow-up Reviews
- [ ] Security deep-dive needed
- [ ] Performance testing required
- [ ] Operational readiness review

---

## Verdict

### Overall Assessment
[Approved / Approved with Conditions / Needs Revision / Not Recommended]

### Conditions for Approval
1. [Condition 1]
2. [Condition 2]

### Next Steps
1. [Immediate action]
2. [Follow-up action]

---

## Memory Bank Updates

- [ ] Create/update module context for [component]
- [ ] Create ADR for [decision]
- [ ] Add knowledge entry for [pattern/lesson]

---

*Review conducted using Architecture Reviewer Agent with Memory Bank context*
```

---

## Example: Microservice Review

```markdown
# Architecture Review Request

## Overview

### What is being reviewed?
New Payment Processing Microservice to replace the current monolithic payment module

### Review Type
- [x] New system/service design
- [x] Technology adoption
- [ ] Integration design

### Urgency
- [x] Pre-implementation (decision needed soon)

---

## Context

### Problem Statement
Current payment processing is embedded in the monolith, causing:
- Deployment coupling (can't update payments independently)
- Scaling issues (can't scale payment processing separately)
- Technology constraints (stuck on legacy payment library)

### Current State
- Payment logic in `OrderService` within monolith
- Direct database calls to shared `payments` table
- Synchronous processing blocking order completion

### Scope
**Included**: Payment initiation, processing, refunds, reporting
**Excluded**: Subscription billing (Phase 2), international payments (Phase 3)

### Constraints
- **Technical**: Must maintain backwards compatibility with existing orders
- **Business**: PCI compliance required, go-live in Q2
- **Organizational**: Only 2 developers available, limited Kubernetes experience

---

## Proposed Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Monolith  │────▶│ Payment Service  │────▶│   Stripe    │
│  (Orders)   │     │   (New K8s)      │     │   (PSP)     │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                    │
       │                    ▼
       │           ┌──────────────────┐
       │           │  Payment Events  │
       │           │    (Kafka)       │
       │           └──────────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐     ┌──────────────────┐
│  Orders DB  │     │  Payments DB     │
│ (Postgres)  │     │  (Postgres)      │
└─────────────┘     └──────────────────┘
```

### Key Components
| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Payment Service | Process payments, manage state | Node.js, Express |
| Payment DB | Payment records, audit log | PostgreSQL |
| Event Bus | Async notifications | Kafka |
| Payment Gateway | External processing | Stripe API |

### Technology Choices
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Node.js | Team expertise, async I/O |
| Database | PostgreSQL | Consistency, existing skills |
| Messaging | Kafka | Existing infrastructure |
| Deployment | Kubernetes | Company standard |

---

## Quality Attribute Requirements

### Performance
- **Latency**: < 200ms for payment initiation
- **Throughput**: 100 payments/second peak
- **Concurrency**: 50 concurrent payment requests

### Availability
- **SLA target**: 99.9%
- **Recovery time**: < 5 minutes
- **Data loss tolerance**: Zero (financial data)

### Security
- **PCI-DSS**: Level 1 compliance required
- **Encryption**: TLS 1.3, AES-256 at rest
- **Audit**: Full audit trail required

---

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data inconsistency | Medium | High | Saga pattern, idempotency |
| Service unavailable | Low | High | Circuit breaker, fallback |
| PCI compliance gap | Low | High | Security review, pen test |

### Open Questions
1. How to handle in-flight payments during migration?
2. Rollback strategy if issues discovered post-launch?

---

## Review Focus Areas
- [x] Overall architectural approach
- [x] Technology choices
- [x] Security considerations
- [x] Integration approach
- [ ] Performance/scalability (covered in separate review)
```

---

## Best Practices

### For Requesters
```yaml
do:
  - Provide complete context
  - Be honest about constraints
  - Include alternatives considered
  - Identify your concerns upfront
  - Bring supporting data

dont:
  - Hide complexity or risks
  - Request review too late
  - Skip the alternatives section
  - Assume reviewers know context
  - Take feedback personally
```

### For Reviewers
```yaml
do:
  - Understand the context first
  - Ask clarifying questions
  - Provide actionable feedback
  - Acknowledge good decisions
  - Consider constraints

dont:
  - Review in isolation
  - Be overly academic
  - Block without alternatives
  - Ignore business reality
  - Rush the review
```

---

*Architecture reviews are collaborative exercises to improve system design. Approach them as a team effort to build better software.*
