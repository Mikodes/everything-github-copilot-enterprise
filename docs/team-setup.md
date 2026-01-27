# Team Setup Guide

This guide helps teams adopt EGCE and establish shared practices for GitHub Copilot.

## Overview

Setting up EGCE for a team involves:
1. Initial setup and configuration
2. Establishing team conventions
3. Training team members
4. Ongoing maintenance

## Prerequisites

- All team members have GitHub Copilot access
- Agreed-upon code standards
- Project repository access
- Node.js 20+ on development machines

## Initial Setup

### 1. Project Initialization

Have one team member (usually Tech Lead) initialize EGCE:

```bash
cd your-project
egce init --stack <your-stack>
```

### 2. Fill Project Context

Edit `.memory-bank/project/context.md` with:

```markdown
---
name: Your Project Name
description: What your project does
version: X.X.X
lastUpdated: YYYY-MM-DD
status: development
---

# Project Context

## Overview
[Project description]

## Business Domain
[What business problem this solves]

## Technology Stack
[Technologies used]

## Architecture
[Architecture overview]
```

### 3. Set Up Team Context

Edit `.memory-bank/team/context.md`:

```markdown
---
name: Your Team Name
lastUpdated: YYYY-MM-DD
---

# Team Context

## Team Members

| Name | Role | GitHub | Expertise |
|------|------|--------|-----------|
| Alice | Tech Lead | @alice | Backend, Architecture |
| Bob | Senior Dev | @bob | Frontend, Testing |

## Working Agreements

### Core Hours
10:00 - 16:00 [Timezone]

### Meetings
- Daily Standup: 10:00
- Sprint Planning: Monday 14:00
- Retro: Friday 15:00

### Communication
- #team-channel for questions
- @mentions for urgent items

### Code Review
- 24 hour turnaround
- 2 approvals required
```

### 4. Create Module Contexts

For each major module/service:

```bash
egce memory add-module user-service
egce memory add-module order-service
egce memory add-module payment-service
```

Then fill in the generated templates.

### 5. Document Key Decisions

Record existing architecture decisions:

```bash
egce memory add-decision "Use PostgreSQL for persistence"
egce memory add-decision "Adopt hexagonal architecture"
egce memory add-decision "Use Kafka for async messaging"
```

### 6. Commit and Share

```bash
git add .
git commit -m "feat: initialize EGCE with Memory Bank"
git push
```

## Team Configuration

### Customize Instructions

Add team-specific instructions to `.github/copilot-instructions/`:

```markdown
# team-conventions.instructions.md

## Our Conventions

### Naming
- Services: {Domain}Service
- Repositories: {Entity}Repository
- DTOs: {Entity}Dto

### Error Handling
- Use custom exceptions
- Always include correlation IDs

### Testing
- Minimum 80% coverage
- Use AssertJ for assertions
```

### Add Custom Prompts

Create team prompts in `.github/prompts/`:

```markdown
# create-feature.prompt.md

## Create New Feature

Create a new feature following our standards:

1. Create branch: feature/{ticket}-{description}
2. Implement with tests
3. Update module context if needed
4. Create PR with template
```

### Configure MCP (Optional)

If using MCP tools, configure in `.github/mcp/`:

```json
{
  "servers": [
    {
      "name": "jira",
      "command": "npx",
      "args": ["-y", "@your-org/mcp-jira"]
    }
  ]
}
```

## Team Training

### Session 1: Introduction (30 min)

1. What is EGCE?
2. Memory Bank overview
3. How Copilot uses context
4. Demo of context-aware suggestions

### Session 2: Hands-On (1 hour)

1. Tour the Memory Bank structure
2. Practice updating contexts
3. Create an ADR together
4. Use an agent

### Session 3: Best Practices (30 min)

1. When to update Memory Bank
2. Writing good documentation
3. Using prompts effectively
4. Maintaining quality

### Materials

- This guide
- Example Memory Bank entries
- Cheat sheet of commands
- FAQ document

## Roles and Responsibilities

### Tech Lead

- Initial setup and configuration
- Architecture documentation
- ADR reviews
- Overall Memory Bank quality

### Team Members

- Keep module contexts current
- Document troubleshooting solutions
- Report patterns and anti-patterns
- Create and use prompts

### Memory Bank Curator (Rotating)

Weekly rotation to:
- Review recent additions
- Check for outdated content
- Ensure consistency
- Report issues

## Workflow Integration

### PR Template

Add Memory Bank considerations to PR template:

```markdown
## Checklist

- [ ] Code follows team standards
- [ ] Tests added/updated
- [ ] Memory Bank updated (if applicable)
  - [ ] Module context
  - [ ] New patterns documented
  - [ ] ADR created (if significant decision)
```

### Sprint Activities

**Sprint Planning**:
- Review relevant ADRs
- Check module contexts for affected areas

**During Sprint**:
- Update contexts as you code
- Document decisions when made

**Sprint Retro**:
- What knowledge should we capture?
- Any patterns worth documenting?
- Update Memory Bank as action item

### Onboarding New Members

1. Share this guide
2. Tour the Memory Bank
3. Assign reading:
   - Project context
   - Their team's modules
   - Key ADRs
4. First PR includes Memory Bank update
5. Pair with Memory Bank Curator

## Maintenance

### Daily

- Update context while working
- Check for answers before asking
- Document solutions when found

### Weekly

**Memory Bank Curator**:
- Review recent changes
- Check for duplicates
- Update outdated entries

### Monthly

**Team Lead**:
- Full validation: `egce memory validate`
- Review structure
- Archive deprecated content

### Quarterly

**Team**:
- Knowledge audit
- Structure review
- Collect feedback
- Plan improvements

## Metrics

Track adoption with:

### Quantitative

- Memory Bank entries count
- Update frequency
- ADRs created
- Knowledge base growth

### Qualitative

- Onboarding time reduction
- Question frequency in chat
- Documentation satisfaction
- Copilot usefulness rating

## Common Challenges

### "No One Updates It"

**Solutions**:
- Make it part of PR checklist
- Include in definition of done
- Celebrate contributions
- Lead by example

### "It's Always Outdated"

**Solutions**:
- Add update dates
- Schedule reviews
- Reduce scope (less is more)
- Integrate with workflow

### "Too Much to Read"

**Solutions**:
- Focus on entry points
- Use summaries
- Cross-reference instead of duplicate
- Progressive disclosure

### "Different Styles"

**Solutions**:
- Use templates consistently
- Review in PRs
- Document style guidelines
- Automate validation

## Checklist

### Initial Setup

- [ ] Initialize EGCE
- [ ] Fill project context
- [ ] Create team context
- [ ] Add module contexts
- [ ] Document key decisions
- [ ] Commit and push

### Team Adoption

- [ ] Train team on Memory Bank
- [ ] Assign initial curator
- [ ] Add to PR template
- [ ] Add to sprint activities
- [ ] Create onboarding path

### Ongoing

- [ ] Weekly reviews scheduled
- [ ] Monthly validation scheduled
- [ ] Metrics being tracked
- [ ] Feedback being collected

## Resources

- [Getting Started](./getting-started.md)
- [Memory Bank Guide](./memory-bank-guide.md)
- [CLI Reference](./cli-reference.md)
- [Example Memory Bank](../examples/)
