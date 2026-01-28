# Team Conventions Instructions

## Purpose

Define team-specific conventions, practices, and unwritten rules that complement enterprise standards. These conventions represent accumulated team wisdom and should be followed for consistency and collaboration.

---

## Code Conventions

### Naming Patterns

#### Files and Directories
```yaml
components:
  pattern: "PascalCase"
  example: "UserProfile.tsx"

utilities:
  pattern: "camelCase"
  example: "formatDate.ts"

constants:
  pattern: "SCREAMING_SNAKE_CASE"
  example: "API_ENDPOINTS.ts"

tests:
  pattern: "[filename].test.ts or [filename].spec.ts"
  example: "UserProfile.test.tsx"

styles:
  pattern: "[ComponentName].module.css"
  example: "UserProfile.module.css"
```

#### Variables and Functions
```yaml
variables:
  - Use descriptive names over abbreviations
  - Boolean: prefix with is, has, can, should
  - Arrays: use plural nouns
  - Handlers: prefix with handle or on

examples:
  good:
    - isAuthenticated
    - hasPermission
    - userProfiles
    - handleSubmit
    - onUserSelect

  avoid:
    - auth (unclear if boolean or object)
    - perm
    - userArr
    - submit
    - userSel
```

### Code Organization

#### File Structure
```typescript
// 1. Imports (grouped and ordered)
// External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal modules
import { UserService } from '@/services';
import { formatDate } from '@/utils';

// Local imports
import { UserAvatar } from './UserAvatar';
import styles from './UserProfile.module.css';

// 2. Types/Interfaces
interface UserProfileProps {
  userId: string;
  showDetails?: boolean;
}

// 3. Constants
const DEFAULT_AVATAR = '/images/default-avatar.png';

// 4. Component/Function
export function UserProfile({ userId, showDetails = true }: UserProfileProps) {
  // Implementation
}

// 5. Exports (if not inline)
```

#### Import Order
```yaml
order:
  1: External libraries (react, lodash, etc.)
  2: Internal shared modules (@/services, @/utils)
  3: Parent/sibling modules (../, ./)
  4: Styles and assets

separator: "Blank line between groups"
```

### Comment Conventions

#### When to Comment
```yaml
always_comment:
  - Complex business logic
  - Non-obvious performance optimizations
  - Workarounds for known issues (with ticket reference)
  - Public API contracts

never_comment:
  - Self-explanatory code
  - Every function or variable
  - Obvious logic
```

#### Comment Format
```typescript
// Single line for brief notes

/**
 * Multi-line for complex explanations.
 * Include context about WHY, not just WHAT.
 * Reference tickets when relevant: PROJ-1234
 */

// TODO: Brief description (PROJ-XXXX)
// FIXME: Description of bug (PROJ-XXXX)
// HACK: Temporary workaround for X (remove after Y)
```

---

## Git Conventions

### Branch Naming
```yaml
format: "{type}/{ticket}-{brief-description}"

types:
  - feature: New features
  - bugfix: Bug fixes
  - hotfix: Production emergency fixes
  - refactor: Code refactoring
  - docs: Documentation updates
  - test: Test additions/fixes

examples:
  - feature/PROJ-123-user-authentication
  - bugfix/PROJ-456-login-redirect
  - hotfix/PROJ-789-payment-failure
  - refactor/PROJ-101-cleanup-api-layer
```

### Commit Messages
```yaml
format: "{type}: {description}"

types:
  - feat: New feature
  - fix: Bug fix
  - docs: Documentation
  - style: Formatting (no code change)
  - refactor: Code refactoring
  - test: Adding tests
  - chore: Maintenance tasks

rules:
  - Use present tense: "add" not "added"
  - Keep under 72 characters
  - Reference ticket in body if complex
  - No period at end

examples:
  good:
    - "feat: add user profile page"
    - "fix: resolve null pointer in auth flow"
    - "docs: update API endpoint documentation"

  avoid:
    - "Fixed bug" (no type, vague)
    - "WIP" (not descriptive)
    - "Updates" (meaningless)
```

### Pull Request Conventions
```yaml
title_format: "[PROJ-XXX] Brief description"

description_template: |
  ## Summary
  Brief description of changes

  ## Changes
  - Change 1
  - Change 2

  ## Testing
  - How was this tested?
  - Any manual testing needed?

  ## Screenshots (if UI changes)

  ## Checklist
  - [ ] Tests added/updated
  - [ ] Documentation updated
  - [ ] Memory Bank updated (if applicable)

reviewers:
  - Minimum 1 approval required
  - 2 approvals for critical paths
  - Auto-assign based on CODEOWNERS
```

---

## Communication Conventions

### Slack Channels
```yaml
channels:
  #dev-general:
    purpose: General development discussion
    usage: Questions, announcements, casual chat

  #dev-help:
    purpose: Technical help and support
    usage: Stuck? Ask here first

  #dev-incidents:
    purpose: Production incidents
    usage: Outages, critical bugs, postmortems

  #dev-releases:
    purpose: Release coordination
    usage: Deployment announcements

  #dev-pr-reviews:
    purpose: PR review requests
    usage: Need eyes on a PR? Post here

etiquette:
  - Use threads for discussions
  - React with emoji to acknowledge
  - Mark urgent with :rotating_light:
  - Don't @channel unless truly urgent
```

### Code Review Communication
```yaml
feedback_prefixes:
  "nit:": Minor suggestion, non-blocking
  "suggestion:": Improvement idea, discuss
  "question:": Need clarification
  "blocker:": Must be addressed before merge
  "praise:": Highlighting good work

examples:
  - "nit: Could use a more descriptive variable name"
  - "blocker: This introduces a security vulnerability"
  - "praise: Great use of the factory pattern here!"

response_expectations:
  - Acknowledge all comments
  - Resolve or respond within 24 hours
  - Don't take feedback personally
  - Explain reasoning if disagreeing
```

### Meeting Conventions
```yaml
standup:
  format: "async in Slack"
  content:
    - Yesterday's accomplishments
    - Today's focus
    - Blockers (if any)

code_review_sessions:
  frequency: "Weekly, optional"
  purpose: "Knowledge sharing, complex PRs"

tech_debt_review:
  frequency: "Bi-weekly"
  purpose: "Prioritize and plan tech debt work"
```

---

## Testing Conventions

### Test Organization
```yaml
structure:
  unit_tests:
    location: "Same directory as source, .test.ts suffix"
    focus: "Individual functions/components"

  integration_tests:
    location: "__tests__/integration/"
    focus: "Module interactions"

  e2e_tests:
    location: "e2e/"
    focus: "User journeys"
```

### Test Naming
```yaml
pattern: "describe what, when, expected outcome"

examples:
  good:
    - "should return user when valid ID provided"
    - "should throw error when user not found"
    - "renders loading state while fetching"

  avoid:
    - "test1"
    - "works correctly"
    - "handles error"
```

### Test Coverage Expectations
```yaml
targets:
  unit_tests: 80%
  critical_paths: 95%
  new_code: 90%

exceptions:
  - Generated code
  - Simple getters/setters
  - Framework boilerplate
```

---

## Documentation Conventions

### Code Documentation
```yaml
jsdoc_required_for:
  - Public APIs
  - Exported functions
  - Complex internal functions

format: |
  /**
   * Brief description of function.
   *
   * @param paramName - Description of parameter
   * @returns Description of return value
   * @throws ErrorType - When this error occurs
   * @example
   * const result = myFunction('input');
   */
```

### README Standards
```yaml
required_sections:
  - Purpose
  - Quick Start
  - Configuration
  - Development
  - Testing
  - Deployment

update_triggers:
  - New feature added
  - Configuration changed
  - Dependencies updated
  - Setup process changed
```

### ADR Conventions
```yaml
when_to_create:
  - New technology adoption
  - Architecture changes
  - Process changes
  - Breaking changes

format: "Follow ADR template in Memory Bank"
storage: "memory-bank/decisions/"
```

---

## Development Workflow

### Feature Development
```yaml
steps:
  1: "Create branch from main"
  2: "Implement with tests"
  3: "Self-review before PR"
  4: "Create PR with description"
  5: "Address review feedback"
  6: "Squash and merge"
  7: "Delete branch"
  8: "Update Memory Bank if needed"
```

### Bug Fixes
```yaml
steps:
  1: "Reproduce and document bug"
  2: "Write failing test first"
  3: "Implement fix"
  4: "Verify test passes"
  5: "Create PR with bug reference"
  6: "Consider adding to knowledge base"
```

### Hotfixes
```yaml
steps:
  1: "Branch from production tag"
  2: "Minimal fix only"
  3: "Expedited review process"
  4: "Deploy to production"
  5: "Cherry-pick to main"
  6: "Create postmortem if significant"
```

---

## Anti-Patterns to Avoid

### Code
```yaml
avoid:
  - Magic numbers without constants
  - Deeply nested callbacks
  - God classes/files
  - Copy-paste programming
  - Premature optimization
  - Over-engineering
```

### Git
```yaml
avoid:
  - Force pushing to shared branches
  - Committing secrets or credentials
  - Large commits with mixed concerns
  - Merge commits (prefer rebase)
  - Long-lived feature branches
```

### Communication
```yaml
avoid:
  - Silent changes to shared code
  - Assuming context in messages
  - Drive-by code reviews
  - Ignoring CI failures
  - Merging without approval
```

---

## Onboarding Checklist

### Week 1
- [ ] Read this conventions guide
- [ ] Review enterprise standards
- [ ] Complete environment setup
- [ ] Join all relevant Slack channels
- [ ] Meet team members

### Week 2
- [ ] Complete first PR following conventions
- [ ] Shadow a code review
- [ ] Explore Memory Bank
- [ ] Attend first standup

### First Month
- [ ] Lead a code review
- [ ] Document something new in knowledge base
- [ ] Suggest a convention improvement

---

*These conventions are living documentation. If you find something outdated or have improvements, please suggest changes through a PR to the team-workflows repository.*
