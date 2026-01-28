# Tech Radar Instructions

## Purpose

Provide guidelines for maintaining a Technology Radar that helps teams make informed decisions about technology adoption, tracks the health of the current stack, and guides strategic technical direction.

---

## What is a Tech Radar?

A Technology Radar is a visual tool that categorizes technologies by their recommended adoption status. It provides:

- **Guidance** on what technologies to use or avoid
- **Visibility** into the team's technology landscape
- **Alignment** on strategic technical direction
- **History** of technology decisions over time

---

## Radar Structure

### Quadrants

```yaml
quadrants:
  techniques:
    description: "Practices, patterns, and approaches"
    examples:
      - Microservices
      - Event-driven architecture
      - Test-driven development
      - Infrastructure as Code

  tools:
    description: "Software tools and utilities"
    examples:
      - VS Code
      - Docker
      - Kubernetes
      - Terraform

  platforms:
    description: "Infrastructure and platforms"
    examples:
      - AWS
      - Azure
      - Vercel
      - MongoDB Atlas

  languages_frameworks:
    description: "Programming languages and frameworks"
    examples:
      - TypeScript
      - React
      - Spring Boot
      - .NET Core
```

### Rings

```yaml
rings:
  adopt:
    description: "Proven, recommended for use"
    meaning: |
      Technologies we have high confidence in.
      Use by default for new projects.
      Well understood by the team.
    guidance: "Use it"
    color: "#93c47d"  # Green

  trial:
    description: "Worth pursuing, assess fit"
    meaning: |
      Technologies showing promise.
      Use in low-risk projects to build experience.
      Evaluate for broader adoption.
    guidance: "Try it in appropriate contexts"
    color: "#6fa8dc"  # Blue

  assess:
    description: "Explore for understanding"
    meaning: |
      Technologies worth watching.
      Research and prototype, don't use in production.
      Understand potential benefits and risks.
    guidance: "Investigate and learn"
    color: "#ffd966"  # Yellow

  hold:
    description: "Proceed with caution"
    meaning: |
      Technologies to avoid for new work.
      May be legacy we're moving away from.
      May have known issues or better alternatives.
    guidance: "Don't use for new projects"
    color: "#e06666"  # Red
```

---

## Radar Entry Format

### Entry Template

```yaml
name: "[Technology Name]"
quadrant: "[techniques|tools|platforms|languages_frameworks]"
ring: "[adopt|trial|assess|hold]"
moved: "[in|out|unchanged]"  # Movement since last update

description: |
  Brief description of what this technology is.

rationale: |
  Why it's in this ring. What are the considerations?

use_cases:
  - When to use this
  - Appropriate contexts

avoid_when:
  - Situations where this isn't appropriate

alternatives:
  - Alternative 1
  - Alternative 2

resources:
  - link: "https://example.com/docs"
    description: "Official documentation"

last_updated: "YYYY-MM-DD"
related_adrs:
  - ADR-XXX
```

### Example Entries

```yaml
# ADOPT Ring
- name: "TypeScript"
  quadrant: "languages_frameworks"
  ring: "adopt"
  moved: "unchanged"
  description: |
    Typed superset of JavaScript. Our standard for all
    frontend and Node.js backend development.
  rationale: |
    Improves code quality, catches errors early,
    excellent IDE support. Team is proficient.
  use_cases:
    - All new JavaScript projects
    - Migrating existing JS codebases
  avoid_when:
    - Quick scripts (plain JS acceptable)
    - Team unfamiliar (provide training first)
  alternatives:
    - JavaScript (acceptable for simple scripts)
    - Flow (not recommended)
  last_updated: "2024-01-15"

# TRIAL Ring
- name: "Bun"
  quadrant: "platforms"
  ring: "trial"
  moved: "in"
  description: |
    Fast JavaScript runtime alternative to Node.js
    with built-in bundler and test runner.
  rationale: |
    Promising performance improvements. Evaluating
    for specific use cases. Not yet production-ready
    for our main applications.
  use_cases:
    - Internal tools
    - New microservices
    - Build tooling experiments
  avoid_when:
    - Customer-facing production services
    - Complex Node.js ecosystem dependencies
  alternatives:
    - Node.js (current standard)
    - Deno (also in assess)
  last_updated: "2024-01-10"
  related_adrs:
    - ADR-022

# ASSESS Ring
- name: "HTMX"
  quadrant: "languages_frameworks"
  ring: "assess"
  moved: "in"
  description: |
    Library for accessing AJAX, CSS Transitions,
    WebSockets directly in HTML.
  rationale: |
    Interesting alternative to SPA frameworks for
    certain use cases. Researching applicability
    to our admin interfaces.
  use_cases:
    - Simple interactive pages
    - Server-rendered applications
  avoid_when:
    - Complex client-side state
    - Rich interactive applications
  alternatives:
    - React (current standard)
    - Alpine.js (also in assess)
  last_updated: "2024-01-05"

# HOLD Ring
- name: "AngularJS (1.x)"
  quadrant: "languages_frameworks"
  ring: "hold"
  moved: "unchanged"
  description: |
    Legacy frontend framework. End of life.
  rationale: |
    No longer maintained. Security risks.
    Migration to React in progress.
  use_cases:
    - None for new development
  avoid_when:
    - All new projects
    - Any new features in existing apps
  alternatives:
    - React (recommended)
    - Angular (modern version)
  last_updated: "2024-01-01"
  related_adrs:
    - ADR-005
```

---

## Governance Process

### Adding New Technologies

```yaml
process:
  1_propose:
    who: "Any team member"
    how: "Submit radar entry proposal"
    includes:
      - Technology description
      - Proposed ring
      - Use case justification
      - Risk assessment

  2_evaluate:
    who: "Architecture team"
    how: "Review proposal"
    criteria:
      - Strategic fit
      - Team capability
      - Maintenance burden
      - Security implications
      - Cost considerations

  3_trial:
    who: "Sponsoring team"
    how: "Proof of concept"
    deliverables:
      - Working prototype
      - Findings document
      - Recommendation

  4_decide:
    who: "Architecture review board"
    how: "Formal decision"
    outcomes:
      - Accept with ring assignment
      - Request more information
      - Reject with reasoning

  5_document:
    who: "Architecture team"
    how: "Update radar and ADR"
    includes:
      - Radar entry
      - ADR if significant
      - Guidelines for use
```

### Moving Technologies

```yaml
movement_triggers:
  promote:  # Move toward Adopt
    - Successful trial results
    - Broad team adoption
    - Proven in production
    - Better than alternatives

  demote:  # Move toward Hold
    - Problems discovered
    - Better alternatives available
    - End of vendor support
    - Security vulnerabilities

review_frequency:
  quarterly: "Full radar review"
  continuous: "Individual entry updates"
```

### Exceptions Process

```yaml
when_needed:
  - Project requires Hold technology
  - Need to skip trial phase
  - Urgent technology adoption

process:
  1: "Document exception request"
  2: "Identify risks and mitigations"
  3: "Get architecture approval"
  4: "Set review date"
  5: "Track exception"
```

---

## Integration with Memory Bank

### Radar Storage

```yaml
location: "memory-bank/tech-radar/"

files:
  radar.json:
    description: "Current radar state"
    format: "JSON with all entries"

  history/:
    description: "Historical snapshots"
    format: "Dated JSON files"

  proposals/:
    description: "Pending proposals"
    format: "Markdown proposals"
```

### Queries

```typescript
// Get current radar
const radar = await memoryBank.getTechRadar();

// Get technologies in specific ring
const adoptedTech = await memoryBank.getTechByRing('adopt');

// Check technology status
const status = await memoryBank.getTechStatus('TypeScript');

// Get radar history
const history = await memoryBank.getRadarHistory('React');
```

---

## Visualization

### Radar Diagram

```
                    TECHNIQUES
                        │
           ┌────────────┼────────────┐
           │    ┌───────┼───────┐    │
           │    │  ┌────┼────┐  │    │
           │    │  │  ADOPT  │  │    │
           │    │  │    ●    │  │    │
           │    │  │ ●     ● │  │    │
     ──────┼────┼──┼─────────┼──┼────┼──────
   TOOLS   │    │  │  TRIAL  │  │    │ LANGUAGES
           │    │  │    ○    │  │    │ FRAMEWORKS
           │    │  └─────────┘  │    │
           │    │    ASSESS     │    │
           │    │      ◇        │    │
           │    └───────────────┘    │
           │         HOLD            │
           │          △              │
           └─────────────────────────┘
                        │
                   PLATFORMS

Legend: ● Adopt  ○ Trial  ◇ Assess  △ Hold
```

### Dashboard View

```yaml
dashboard_elements:
  summary:
    - Total technologies tracked
    - Distribution by ring
    - Recent movements

  alerts:
    - Technologies approaching hold
    - Expiring trial periods
    - Pending proposals

  trends:
    - Adoption velocity
    - Technology churn
    - Quadrant distribution
```

---

## Best Practices

### For Teams

```yaml
do:
  - Check radar before adopting new tech
  - Propose technologies through proper channels
  - Share experiences with trial technologies
  - Report issues with adopted technologies
  - Participate in radar reviews

dont:
  - Adopt Hold technologies without exception
  - Skip the trial phase for significant tech
  - Use Assess technologies in production
  - Ignore radar guidance
  - Hoard technology knowledge
```

### For Architecture Team

```yaml
do:
  - Keep radar updated and accurate
  - Communicate changes clearly
  - Provide rationale for decisions
  - Consider team feedback
  - Balance innovation with stability

dont:
  - Let radar become stale
  - Make unilateral decisions
  - Ignore practical constraints
  - Over-complicate the process
  - Block all new technology
```

---

## Radar Review Checklist

### Quarterly Review

```markdown
## Tech Radar Quarterly Review

### Date: [YYYY-MM-DD]
### Participants: [List]

### Review Items

#### Adopt Ring
- [ ] All technologies still appropriate?
- [ ] Any ready to move from Trial?
- [ ] Team proficiency confirmed?

#### Trial Ring
- [ ] Trial periods evaluated?
- [ ] Findings documented?
- [ ] Ready for promotion or demotion?

#### Assess Ring
- [ ] Research progress reviewed?
- [ ] Any ready for Trial?
- [ ] Any to be dropped?

#### Hold Ring
- [ ] Migration status checked?
- [ ] Exceptions still valid?
- [ ] Any to be removed entirely?

### New Proposals
- [ ] Pending proposals reviewed
- [ ] Decisions documented

### Actions
- [ ] Radar updated
- [ ] Changes communicated
- [ ] ADRs created if needed
```

---

*The Tech Radar is a living document that guides technology decisions. Keep it current, make it visible, and use it consistently to maintain technical coherence across the organization.*
