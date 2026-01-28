# First Task Checklist Prompt

## Purpose

Guide new team members through completing their first task with confidence, ensuring they follow team practices while building understanding of the codebase and workflow.

---

## Prompt Template

```markdown
# First Task Completion Guide

## Task Information
- **Ticket**: [PROJ-XXX]
- **Title**: [Task title]
- **Type**: [Bug Fix / Feature / Improvement]
- **Complexity**: [Small / Medium]
- **Mentor**: [Assigned mentor name]

## Pre-Work Checklist

### Understanding the Task
- [ ] Read the ticket description completely
- [ ] Understand the acceptance criteria
- [ ] Identify questions for clarification
- [ ] Discuss with mentor if unclear

### Context Gathering
- [ ] Check Memory Bank for related modules
- [ ] Review relevant ADRs
- [ ] Look at similar existing implementations
- [ ] Understand affected components

### Environment Ready
- [ ] Latest code from main branch
- [ ] All tests passing locally
- [ ] Development server running
- [ ] Relevant documentation open

## Implementation Checklist

### Getting Started
- [ ] Create feature branch: `{type}/PROJ-XXX-brief-description`
- [ ] Set up local testing environment
- [ ] Identify files to modify
- [ ] Plan approach (discuss with mentor if needed)

### Development
- [ ] Write/modify tests first (TDD approach)
- [ ] Implement changes incrementally
- [ ] Commit frequently with clear messages
- [ ] Self-review as you go

### Quality Checks
- [ ] All existing tests still pass
- [ ] New tests cover the changes
- [ ] No linting errors or warnings
- [ ] Code follows team conventions
- [ ] No console.logs or debug code

## Pre-PR Checklist

### Self-Review
- [ ] Read through all changes
- [ ] Check for typos and formatting
- [ ] Verify variable/function naming
- [ ] Ensure no unrelated changes included

### Testing Verification
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases considered
- [ ] Error scenarios handled

### Documentation
- [ ] Code comments where needed
- [ ] README updated (if applicable)
- [ ] Memory Bank entry (if significant)

## Pull Request Checklist

### PR Creation
- [ ] Title follows format: `[PROJ-XXX] Brief description`
- [ ] Description template filled out
- [ ] Linked to ticket
- [ ] Assigned reviewers
- [ ] Labels applied

### PR Description Contents
- [ ] Summary of changes
- [ ] Why this approach was chosen
- [ ] How to test
- [ ] Screenshots (for UI changes)
- [ ] Breaking changes noted

## Review Response Checklist

### Handling Feedback
- [ ] Acknowledge all comments
- [ ] Ask for clarification if needed
- [ ] Make requested changes
- [ ] Re-request review when ready
- [ ] Don't take feedback personally!

### After Approval
- [ ] All CI checks passing
- [ ] Squash and merge
- [ ] Delete feature branch
- [ ] Verify deployment (if applicable)
- [ ] Close/update ticket

## Post-Merge Checklist

### Knowledge Capture
- [ ] Document any learnings
- [ ] Update Memory Bank if needed
- [ ] Share insights with team
- [ ] Note any follow-up tasks

### Celebration!
- [ ] Acknowledge your first contribution!
- [ ] Thank reviewers
- [ ] Ready for the next task!
```

---

## Usage Example: Bug Fix

```markdown
# First Task Completion Guide

## Task Information
- **Ticket**: PROJ-123
- **Title**: Fix login redirect loop on expired session
- **Type**: Bug Fix
- **Complexity**: Small
- **Mentor**: Sarah Chen

## Pre-Work Checklist

### Understanding the Task
- [x] Read the ticket description completely
  - User is stuck in redirect loop when session expires
  - Expected: Redirect to login page once
  - Actual: Infinite redirect loop
- [x] Understand the acceptance criteria
  - Session expiry redirects to login once
  - Login shows appropriate message
  - User can log in again successfully
- [x] Identify questions for clarification
  - Q: Where is session validation happening?
  - A: AuthMiddleware.ts and useAuth hook
- [x] Discuss with mentor if unclear
  - Met with Sarah, confirmed approach

### Context Gathering
- [x] Check Memory Bank for related modules
  - Found: auth-module documentation
  - Found: session-management ADR-008
- [x] Review relevant ADRs
  - ADR-008: Session tokens stored in cookies
  - ADR-012: Redirect handling in SPA
- [x] Look at similar existing implementations
  - Found: handleSessionExpiry in AuthContext
- [x] Understand affected components
  - AuthMiddleware.ts
  - useAuth.ts
  - LoginPage.tsx

### Environment Ready
- [x] Latest code from main branch
- [x] All tests passing locally
- [x] Development server running
- [x] Relevant documentation open

## Implementation Checklist

### Getting Started
- [x] Create feature branch: `bugfix/PROJ-123-login-redirect-loop`
- [x] Set up local testing environment
  - Can reproduce bug by manually expiring session
- [x] Identify files to modify
  - src/middleware/AuthMiddleware.ts
  - src/hooks/useAuth.ts
- [x] Plan approach (discuss with mentor if needed)
  - Add redirect tracking to prevent loops
  - Clear redirect flag after successful login

### Development
- [x] Write/modify tests first (TDD approach)
  - Added test: "should not redirect more than once"
  - Added test: "should show expired message"
- [x] Implement changes incrementally
  - Added redirectCount tracking
  - Added max redirect check
- [x] Commit frequently with clear messages
  - "test: add redirect loop test cases"
  - "fix: prevent infinite redirect on session expiry"
- [x] Self-review as you go

### Quality Checks
- [x] All existing tests still pass
- [x] New tests cover the changes
- [x] No linting errors or warnings
- [x] Code follows team conventions
- [x] No console.logs or debug code

## Current Status: Ready for PR!
```

---

## Usage Example: Feature

```markdown
# First Task Completion Guide

## Task Information
- **Ticket**: PROJ-456
- **Title**: Add user avatar upload to profile page
- **Type**: Feature
- **Complexity**: Medium
- **Mentor**: Mike Johnson

## Pre-Work Checklist

### Understanding the Task
- [x] Read the ticket description completely
  - Users want to upload custom profile pictures
  - Support JPG, PNG up to 5MB
  - Crop/resize functionality needed
- [ ] Understand the acceptance criteria
  - [ ] Upload button on profile page
  - [ ] Preview before save
  - [ ] Validation for file type/size
  - [ ] Success/error feedback
- [ ] Identify questions for clarification
  - Q: Where should images be stored? S3 or local?
  - Q: Do we need image compression?
  - Q: Existing image upload patterns to follow?
- [ ] Discuss with mentor if unclear

## Notes
- Waiting for answers to clarifying questions
- Scheduled call with Mike for tomorrow 10am
```

---

## Tips for First Task Success

### Do
```markdown
- Ask questions early and often
- Take notes on what you learn
- Communicate progress and blockers
- Test thoroughly before requesting review
- Read existing code for patterns
- Use the Memory Bank for context
```

### Don't
```markdown
- Stay stuck without asking for help
- Make changes outside task scope
- Skip writing tests
- Ignore CI failures
- Force push to fix mistakes
- Feel bad about needing guidance
```

---

## Getting Help

### When Stuck on Implementation
1. Review similar code in the codebase
2. Check Memory Bank for patterns
3. Search team Slack for discussions
4. Ask in #dev-help channel
5. Schedule time with your mentor

### When Stuck on Process
1. Review team conventions guide
2. Check this checklist
3. Ask your mentor
4. Ask in #dev-help

### When Stuck on Understanding
1. Re-read the ticket
2. Look at related tickets
3. Check Memory Bank for context
4. Ask the ticket creator
5. Discuss with your mentor

---

## Mentor Guidance

### For Mentors Supporting First Tasks

**Before Task Starts**
- Review the task for appropriateness
- Prepare context and resources
- Schedule initial discussion
- Set expectations for check-ins

**During Task**
- Be available for questions
- Provide guidance, not solutions
- Encourage independence
- Offer frequent encouragement

**After Completion**
- Celebrate the achievement
- Gather feedback on process
- Identify next learning goals
- Update onboarding materials if needed

---

*This checklist is designed to build confidence and ensure success on your first contribution. Each completed task adds to your understanding and makes the next one easier!*
