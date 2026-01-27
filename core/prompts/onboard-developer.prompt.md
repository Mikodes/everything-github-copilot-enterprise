---
name: onboard-developer
description: Guide new developers through the codebase and team practices using Memory Bank context
---

# Onboard Developer

Help new team members get up to speed with the project, codebase, and team practices by leveraging the Memory Bank.

## Context Required

Before onboarding:
1. Load project context from `.memory-bank/project/context.md`
2. Load team context from `.memory-bank/team/context.md`
3. Identify relevant module contexts
4. Check recent decisions (ADRs)

## Input

```
Developer Name: {name}
Role: {role}
Experience Level: {junior | mid | senior | staff}
Focus Area: {module or area they'll work on}
Background: {relevant experience}
```

## Onboarding Process

### Phase 1: Welcome & Overview
- Project introduction
- Team introduction
- High-level architecture
- Development environment setup

### Phase 2: Deep Dive
- Module-specific context
- Key patterns and practices
- Important decisions (ADRs)
- Common pitfalls

### Phase 3: Hands-On
- First task assignment
- Buddy pairing
- Code review introduction
- Contributing guidelines

## Output Format

```markdown
# Welcome to {Project Name}! 👋

**Developer**: {name}
**Role**: {role}
**Start Date**: {date}
**Onboarding Buddy**: {buddy name}

---

## 📋 Onboarding Checklist

### Day 1: Environment Setup

- [ ] Access Granted
  - [ ] GitHub repository access
  - [ ] Jira/project management tool
  - [ ] Slack/Teams channels
  - [ ] Cloud provider console (if needed)

- [ ] Development Environment
  - [ ] Clone repository: `{repo URL}`
  - [ ] Install prerequisites: {list}
  - [ ] Run setup script: `{command}`
  - [ ] Verify build: `{command}`
  - [ ] Run tests: `{command}`

- [ ] Verify Access
  - [ ] Can push to feature branch
  - [ ] Can access development environment
  - [ ] Can view CI/CD pipelines

### Day 2-3: Project Understanding

- [ ] Read Documentation
  - [ ] Project README
  - [ ] Memory Bank project context
  - [ ] Architecture overview
  - [ ] Coding standards

- [ ] Codebase Tour
  - [ ] Project structure walkthrough
  - [ ] Key modules overview
  - [ ] Build and deployment process

### Week 1: Deep Dive

- [ ] Focus Area: {module}
  - [ ] Read module context
  - [ ] Understand key components
  - [ ] Review recent changes

- [ ] Key Decisions
  - [ ] Read relevant ADRs
  - [ ] Understand architecture choices

- [ ] First Task
  - [ ] Pick a "good first issue"
  - [ ] Create first PR
  - [ ] Complete code review process

### Week 2-4: Integration

- [ ] Participate in ceremonies
- [ ] Shadow on-call (if applicable)
- [ ] Complete first feature

---

## 🏗️ Project Overview

### What We Build

{Brief description from project context}

### Why It Matters

{Business context and impact}

### Key Features

1. {Feature 1}
2. {Feature 2}
3. {Feature 3}

---

## 🏛️ Architecture Overview

### High-Level Architecture

{Architecture description from project context}

### Key Technologies

| Category | Technology | Version |
|----------|------------|---------|
| Language | {lang} | {version} |
| Framework | {framework} | {version} |
| Database | {db} | {version} |
| Cloud | {cloud} | - |

### Module Structure

| Module | Responsibility | Your Relevance |
|--------|---------------|----------------|
| {module} | {responsibility} | {how it relates to their work} |

---

## 👥 Team Overview

### Team Structure

{From team context}

### Key Contacts

| Role | Person | When to Contact |
|------|--------|-----------------|
| Tech Lead | {name} | Architecture questions |
| Your Buddy | {name} | Day-to-day questions |
| Product Owner | {name} | Requirements questions |

### Communication Channels

| Channel | Purpose |
|---------|---------|
| {channel} | {purpose} |

### Meetings

| Meeting | When | Purpose |
|---------|------|---------|
| Daily Standup | {time} | Sync |
| Sprint Planning | {when} | Plan work |
| Retro | {when} | Improvement |

---

## 🎯 Your Focus Area: {Module Name}

### What This Module Does

{From module context}

### Key Components

- **{Component 1}**: {description}
- **{Component 2}**: {description}

### Important Files to Know

| File | Purpose | Priority |
|------|---------|----------|
| {file} | {purpose} | Start here |
| {file} | {purpose} | Important |

### Dependencies

- Depends on: {modules}
- Depended on by: {modules}

---

## 📚 Key Decisions to Understand

### Recent Important ADRs

1. **[ADR-{XXXX}]** - {title}
   - **Why it matters to you**: {relevance}

2. **[ADR-{YYYY}]** - {title}
   - **Why it matters to you**: {relevance}

---

## ✅ Team Practices

### Git Workflow

{Summary from git-workflow instructions}

### Code Review

{Summary from code-review-checklist}

### Testing

{Summary from testing-standards}

---

## ⚠️ Common Pitfalls

Things new developers often run into:

1. **{Pitfall 1}**
   - Issue: {description}
   - Solution: {how to avoid/fix}

2. **{Pitfall 2}**
   - Issue: {description}
   - Solution: {how to avoid/fix}

---

## 🚀 Your First Task

### Suggested First Issue

{Good first issue or starter task}

### Steps

1. {Step 1}
2. {Step 2}
3. {Step 3}

### What Success Looks Like

- {Expected outcome}

---

## 📖 Learning Resources

### Must Read

- [ ] {Resource 1}
- [ ] {Resource 2}

### Recommended

- {Resource 3}
- {Resource 4}

### Team-Specific

- [ ] Memory Bank knowledge base
- [ ] Team wiki

---

## ❓ Questions?

Don't hesitate to ask! Reach out to:

- **{Buddy}** - Your go-to for everything
- **#{channel}** - Team questions
- **Memory Bank** - Search for documented answers

---

## 📅 Check-in Schedule

| When | With | Focus |
|------|------|-------|
| End of Day 1 | Buddy | Setup complete? |
| End of Week 1 | Tech Lead | Understanding? |
| End of Week 2 | Manager | Settling in? |
| End of Month 1 | Team | Full integration |

---

Welcome to the team! 🎉
```

## Example Usage

**User**: Help onboard Sarah, a senior developer joining to work on the payment module

**Response**: [Complete onboarding guide tailored to Sarah's experience level, focused on the payment module, with relevant ADRs, key contacts, and a suitable first task]
