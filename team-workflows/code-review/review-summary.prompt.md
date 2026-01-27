# Review Summary Prompt

## Purpose

Generate comprehensive review summaries that communicate review outcomes clearly to PR authors, team members, and stakeholders. Summaries provide at-a-glance understanding of review status and required actions.

---

## Prompt Template

```markdown
# Generate Review Summary

## PR Information
- **PR Number**: #[XXX]
- **Title**: [PR Title]
- **Author**: [Author name]
- **Reviewers**: [List of reviewers]
- **Branch**: [source] → [target]

## Review Results
### Comments Made
[List all review comments with severity and status]

### Discussions
[Any threaded discussions or debates]

### Commits Since Review
[Any new commits addressing feedback]

## Generate Summary

Create a comprehensive review summary including:

1. **Executive Summary**: 1-2 sentence overview
2. **Review Status**: Approved / Changes Requested / Pending
3. **Key Findings**: Grouped by severity
4. **Action Items**: What needs to happen next
5. **Timeline**: Review progression
6. **Recommendation**: Final verdict with reasoning
```

---

## Summary Templates

### Template 1: Approved PR Summary

```markdown
# Review Summary: PR #123

## Executive Summary
Authentication refactoring completed successfully with comprehensive test coverage. Minor suggestions provided but not blocking.

---

## Review Status: :white_check_mark: APPROVED

| Reviewer | Status | Comments |
|----------|--------|----------|
| @alice | Approved | 3 suggestions |
| @bob | Approved | 1 praise |

---

## Key Findings

### :star: Highlights
- Excellent test coverage (95%+)
- Clean separation of concerns
- Good error handling patterns

### :bulb: Suggestions (Non-blocking)
1. Consider adding JSDoc to public methods
2. Could extract common validation logic
3. Minor naming improvement on line 45

### :warning: Issues
None identified.

### :stop_sign: Blockers
None identified.

---

## Action Items
- [x] All required approvals received
- [x] CI pipeline passing
- [ ] Author to consider suggestions for future iterations

---

## Timeline
| Date | Event |
|------|-------|
| Jan 15 | PR opened |
| Jan 15 | First review by @alice |
| Jan 16 | Review by @bob |
| Jan 16 | Approved for merge |

---

## Recommendation

:rocket: **Ready to Merge**

This PR is well-implemented and thoroughly tested. Suggestions are minor improvements that can be addressed in future work if desired.

---

*Reviewed with Memory Bank context: auth-module, ADR-008*
```

---

### Template 2: Changes Requested Summary

```markdown
# Review Summary: PR #456

## Executive Summary
Payment processing feature requires security fixes and additional test coverage before merge.

---

## Review Status: :yellow_circle: CHANGES REQUESTED

| Reviewer | Status | Comments |
|----------|--------|----------|
| @alice | Changes requested | 2 blockers, 3 issues |
| @bob | Pending re-review | Waiting for fixes |

---

## Key Findings

### :stop_sign: Blockers (Must Fix)

#### 1. SQL Injection Vulnerability
**Location**: `PaymentService.ts:45`
**Issue**: User input directly in SQL query
**Required Action**: Use parameterized queries
**Assigned**: @author

#### 2. Missing Input Validation
**Location**: `PaymentController.ts:23`
**Issue**: Payment amount not validated
**Required Action**: Add validation for positive amounts
**Assigned**: @author

### :warning: Issues (Should Fix)

1. **Error handling incomplete** - Line 67: Silent failure possible
2. **No retry logic** - API calls may fail transiently
3. **Missing logging** - No audit trail for payments

### :bulb: Suggestions (Optional)

1. Consider using existing PaymentValidator class
2. Add integration test for edge cases

### :star: Positives

- Good overall structure
- Clear separation of concerns
- Comprehensive unit tests for happy path

---

## Action Items

### Required for Merge
- [ ] Fix SQL injection (Blocker #1)
- [ ] Add input validation (Blocker #2)
- [ ] Address error handling issue

### Recommended
- [ ] Add retry logic for API calls
- [ ] Implement audit logging

### Post-Merge
- [ ] Consider suggestions for v2

---

## Timeline
| Date | Event |
|------|-------|
| Jan 20 | PR opened |
| Jan 21 | First review - blockers identified |
| Jan 21 | Waiting for author fixes |

---

## Recommendation

:construction: **Requires Fixes Before Merge**

Security issues must be addressed. Once blockers are resolved and issues are addressed, please request re-review. Happy to help if any questions on the fixes needed.

---

*Reviewed with Memory Bank context: payment-module, ADR-012, security-baseline*
```

---

### Template 3: Complex PR Summary

```markdown
# Review Summary: PR #789

## Executive Summary
Major refactoring of order processing system. Multiple rounds of review completed. Ready for final approval pending architecture sign-off.

---

## Review Status: :large_blue_circle: PENDING FINAL APPROVAL

| Reviewer | Status | Comments |
|----------|--------|----------|
| @alice | Approved | 5 comments addressed |
| @bob | Approved | Architecture feedback incorporated |
| @tech-lead | Pending | Final architecture review |

---

## Key Findings

### Round 1 (Jan 10)
- 2 blockers: Fixed in commit `abc123`
- 5 issues: Addressed in commit `def456`
- 3 suggestions: 2 adopted, 1 deferred

### Round 2 (Jan 12)
- 1 issue: Performance concern - optimized
- 2 suggestions: Adopted

### Round 3 (Jan 14)
- All previous feedback addressed
- New architecture questions raised
- Pending tech lead review

---

## Changes Made

### Commits Addressing Feedback
| Commit | Addressed |
|--------|-----------|
| `abc123` | SQL injection fix, validation |
| `def456` | Error handling improvements |
| `ghi789` | Performance optimization |
| `jkl012` | Architecture adjustments |

### Code Quality Metrics
- Test Coverage: 87% → 94%
- Complexity: Reduced by 15%
- Lines: +450 / -380 (net +70)

---

## Outstanding Items

### Awaiting Response
- [ ] Tech lead architecture approval
- [ ] Performance testing in staging

### Questions for Author
1. Can we add one more integration test for the refund flow?
2. Should we document the new patterns in the Memory Bank?

---

## Discussion Summary

### Architecture Discussion
**Topic**: Whether to use events vs. direct calls for order state changes

**Resolution**: Agreed to use events for async notifications but keep direct calls for synchronous state changes. Documented in comments.

### Performance Discussion
**Topic**: Query optimization for order history

**Resolution**: Added index and pagination. Load testing shows 80% improvement.

---

## Risk Assessment

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Breaking changes | Medium | Feature flag implemented |
| Performance | Low | Load tested, optimized |
| Security | Low | Security review passed |
| Compatibility | Low | Backwards compatible |

---

## Recommendation

:hourglass_flowing_sand: **Awaiting Final Approval**

This PR has undergone thorough review and all technical concerns have been addressed. Pending tech lead sign-off on architecture changes. Recommend approval once architecture review is complete.

### Merge Checklist
- [x] Code review complete
- [x] Tests passing
- [x] Security review passed
- [ ] Architecture approval
- [ ] Staging deployment test

---

*Reviewed with Memory Bank context: order-module, ADR-015, ADR-018*
```

---

### Template 4: Quick Summary (Small PR)

```markdown
# Review Summary: PR #101

**Status**: :white_check_mark: APPROVED

**Summary**: Documentation update for API endpoints. Clear and accurate.

**Reviewer**: @alice - Approved

**Notes**: No code changes, documentation looks good.

**Ready to merge**: Yes
```

---

## Summary Generation Guidelines

### Content Priorities
```yaml
always_include:
  - Overall status
  - Blocking issues
  - Required actions
  - Approval status

include_when_relevant:
  - Discussion summaries
  - Timeline for complex PRs
  - Risk assessment
  - Memory Bank context

optional:
  - Detailed metrics
  - Full comment history
  - Future recommendations
```

### Audience Considerations
```yaml
for_author:
  - Clear action items
  - Specific fix locations
  - Priority ordering
  - Helpful suggestions

for_team:
  - High-level status
  - Learning opportunities
  - Pattern recognition
  - Knowledge sharing

for_stakeholders:
  - Executive summary
  - Risk assessment
  - Timeline
  - Blockers only
```

### Length Guidelines
```yaml
small_pr:
  - 5-10 lines
  - Quick status summary
  - Simple approve/reject

medium_pr:
  - 20-30 lines
  - Key findings
  - Action items
  - Brief recommendation

large_pr:
  - Full template
  - Multiple rounds tracked
  - Detailed discussions
  - Comprehensive metrics
```

---

## Integration with Review Workflow

### When to Generate Summary
```yaml
triggers:
  - All reviewers have commented
  - Changes requested (for author clarity)
  - Ready for merge (final summary)
  - Complex discussions concluded
  - Periodic updates for long-running PRs
```

### Updating Summaries
```yaml
update_when:
  - New round of review completed
  - Author addresses feedback
  - Status changes
  - New blockers discovered
  - Discussion resolved
```

---

*Use these templates to create clear, actionable review summaries that facilitate efficient code review processes and team communication.*
