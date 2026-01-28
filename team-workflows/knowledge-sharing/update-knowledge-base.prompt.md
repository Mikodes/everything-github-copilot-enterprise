# Update Knowledge Base Prompt

## Purpose

Guide the process of updating existing knowledge base entries to keep information current, accurate, and valuable. Ensures knowledge doesn't become stale or misleading.

---

## Prompt Template

```markdown
# Knowledge Base Update Request

## Entry to Update

### Entry Identifier
[Title or path of the knowledge entry]

### Current Location
[memory-bank/knowledge/...]

---

## Update Reason

### Why does this need updating?
- [ ] Information is outdated
- [ ] Technology/process has changed
- [ ] Found an error or inaccuracy
- [ ] Missing important details
- [ ] Better approach discovered
- [ ] Adding real-world experience
- [ ] Clarifying confusing section
- [ ] Adding examples
- [ ] Fixing broken links
- [ ] Improving organization
- [ ] Other: ___________

### What triggered this update?
[How did you discover the entry needed updating?]

---

## Current Content Summary

### What does the entry currently say?
[Brief summary of existing content]

### What's wrong or outdated?
[Specific issues with current content]

---

## Proposed Changes

### What should be added?
[New information to include]

### What should be removed?
[Information that's no longer accurate or relevant]

### What should be modified?
[Existing content that needs correction]

---

## Validation

### How did you verify this information?
- [ ] Tested it myself
- [ ] Reviewed with subject matter expert
- [ ] Confirmed with official documentation
- [ ] Based on recent production experience
- [ ] Discussed with team

### Who should review this update?
[Suggested reviewers]

---

## Impact Assessment

### Who uses this knowledge?
[Teams or roles that rely on this entry]

### Could this update break anything?
[Any risks from changing this information]

### Should users be notified?
[Is this a significant enough change to announce?]

---

## Generate Updated Entry

Please create the updated knowledge entry with:
1. All changes clearly incorporated
2. Updated metadata (last updated date, editor)
3. Change log entry if significant
4. Preserved historical context where relevant
5. Updated cross-references
```

---

## Update Types and Procedures

### Minor Updates

```yaml
description: "Small fixes that don't change meaning"
examples:
  - Typo corrections
  - Formatting improvements
  - Link fixes
  - Clarifying wording

process:
  - Make the change directly
  - Update "last updated" date
  - No review required

tracking:
  - Note in commit message
  - No changelog entry needed
```

### Content Updates

```yaml
description: "Changes to the actual knowledge content"
examples:
  - Adding new information
  - Correcting errors
  - Updating procedures
  - Adding examples

process:
  - Draft the changes
  - Get review if significant
  - Update metadata
  - Add changelog entry

tracking:
  - Summarize in changelog
  - Consider notifying users
```

### Major Revisions

```yaml
description: "Significant changes to content or structure"
examples:
  - Complete rewrite
  - Process changes
  - Technology migration
  - Fundamental corrections

process:
  - Draft complete revision
  - Review with stakeholders
  - Consider keeping old version accessible
  - Announce to affected teams

tracking:
  - Detailed changelog
  - Notify subscribers
  - Update related entries
```

### Deprecation

```yaml
description: "Entry is no longer applicable"
examples:
  - Technology deprecated
  - Process eliminated
  - Superseded by new entry

process:
  - Add deprecation notice
  - Link to replacement if any
  - Move to archive
  - Keep accessible for history

tracking:
  - Mark status as deprecated
  - Note replacement in changelog
  - Update references
```

---

## Example: Updating Outdated Procedure

```markdown
# Knowledge Base Update Request

## Entry to Update

### Entry Identifier
"How to Deploy to Production"

### Current Location
memory-bank/knowledge/how-to/deployment/production-deploy.md

---

## Update Reason

### Why does this need updating?
- [x] Technology/process has changed
- [x] Missing important details

### What triggered this update?
New CI/CD pipeline was deployed last week. Current docs reference old Jenkins workflow that no longer exists.

---

## Current Content Summary

### What does the entry currently say?
- Log into Jenkins at jenkins.internal
- Find the "Production Deploy" job
- Click "Build with Parameters"
- Enter the version number
- Click Build

### What's wrong or outdated?
- We no longer use Jenkins
- Deployment is now through GitHub Actions
- Process is completely different

---

## Proposed Changes

### What should be added?
- GitHub Actions workflow trigger process
- New approval workflow
- Environment variable configuration
- Rollback procedure (wasn't documented before)

### What should be removed?
- All Jenkins references
- Old parameter descriptions

### What should be modified?
- Prerequisites section (need GitHub access now, not Jenkins)
- Verification steps (different monitoring dashboard)

---

## Validation

### How did you verify this information?
- [x] Tested it myself
- [x] Reviewed with subject matter expert
- [x] Confirmed with official documentation

### Who should review this update?
DevOps team lead (owner of new pipeline)

---

## Impact Assessment

### Who uses this knowledge?
All developers who deploy (everyone)

### Could this update break anything?
No, but people might try old process if they don't see update

### Should users be notified?
Yes - send to #dev-general and include in next week's digest

---

## Updated Entry

# How to Deploy to Production

## Metadata
- **Type**: how_to
- **Tags**: deployment, production, github-actions, ci-cd
- **Created**: 2023-06-15
- **Last Updated**: 2024-01-22
- **Status**: published

## Changelog
| Date | Change | Author |
|------|--------|--------|
| 2024-01-22 | Complete rewrite for GitHub Actions | @devops-lead |
| 2023-06-15 | Initial version (Jenkins) | @previous-author |

## Summary
Deploy your changes to production using GitHub Actions with required approvals.

## Prerequisites
- [ ] GitHub repository access
- [ ] Member of `deployers` team
- [ ] Changes merged to `main` branch
- [ ] All CI checks passing

## Deployment Steps

### 1. Navigate to Actions
Go to the repository on GitHub and click the "Actions" tab.

### 2. Select Deployment Workflow
Find "Deploy to Production" in the workflow list.

### 3. Trigger Deployment
Click "Run workflow" and fill in:
- **Branch**: Select `main`
- **Version**: Enter the release version (e.g., `v1.2.3`)
- **Notes**: Brief description of what's being deployed

### 4. Approve Deployment
- A Slack notification will be sent to #deploy-approvals
- Two approvers from @platform-team must approve
- Approval expires after 1 hour

### 5. Monitor Deployment
- Watch the Actions workflow progress
- Check #deploy-status for updates
- Verify in [Grafana Dashboard](https://grafana.internal/production)

## Rollback Procedure

If issues are discovered:

1. Go to Actions → "Rollback Production"
2. Select the previous good version
3. Trigger rollback (requires 1 approval)
4. Notify #incidents if customer-impacting

## Troubleshooting

### "Approval timeout"
Re-trigger the workflow - approvals expire after 1 hour.

### "Permission denied"
Verify you're in the `deployers` team. Contact #platform-help.

### "Workflow failed"
Check the workflow logs. Common issues:
- Failed health checks → verify staging works first
- Resource limits → contact platform team

## Related
- [Deployment Architecture ADR](../decisions/ADR-018-deployment-pipeline.md)
- [Rollback Procedures](./production-rollback.md)
- [Staging Deployment](./staging-deploy.md)
```

---

## Update Checklist

### Before Making Changes

```markdown
- [ ] Verified current content is actually wrong/outdated
- [ ] Understood why it was written that way originally
- [ ] Identified all places this information is referenced
- [ ] Checked if this affects other documentation
```

### When Making Changes

```markdown
- [ ] Preserved useful historical context
- [ ] Maintained consistent formatting
- [ ] Updated all affected cross-references
- [ ] Added changelog entry for significant changes
- [ ] Updated metadata (date, editor, status)
```

### After Making Changes

```markdown
- [ ] Reviewed the changes for accuracy
- [ ] Tested any procedures or code examples
- [ ] Updated related entries if needed
- [ ] Notified affected teams if significant
- [ ] Scheduled future review if appropriate
```

---

## Handling Conflicting Information

### When You Find Contradictions

```yaml
steps:
  1_identify:
    - Document both versions
    - Note where each appears
    - Identify which is being used in practice

  2_investigate:
    - Check with subject matter experts
    - Review recent changes or decisions
    - Look at actual system behavior

  3_resolve:
    - Determine correct information
    - Update all locations consistently
    - Note why the confusion existed

  4_prevent:
    - Consider if reorganization needed
    - Add cross-references
    - Implement review process
```

---

## Automation Opportunities

### Staleness Detection

```yaml
automated_checks:
  age_alerts:
    - Entries older than 6 months without review
    - Entries in high-change areas not updated

  reference_checks:
    - Broken internal links
    - References to deprecated entries
    - Orphaned entries

  usage_analysis:
    - Entries with low access
    - Entries with negative feedback
    - Search queries with no results
```

### Update Triggers

```yaml
triggers:
  code_changes:
    - README changes trigger doc review
    - API changes flag related entries
    - Dependency updates prompt review

  events:
    - Incidents create review tasks
    - ADR acceptance triggers updates
    - Process changes flag procedures
```

---

*Keeping knowledge current is as important as creating it. Regular updates ensure the knowledge base remains a trusted, valuable resource.*
