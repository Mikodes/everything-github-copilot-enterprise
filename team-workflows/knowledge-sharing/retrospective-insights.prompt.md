# Retrospective Insights Prompt

## Purpose

Extract actionable insights from team retrospectives and convert them into documented knowledge, process improvements, and tracked action items. Ensure retrospective learnings create lasting value.

---

## Prompt Template

```markdown
# Retrospective Insights Extraction

## Retrospective Context

### Event Details
- **Team**: [Team name]
- **Date**: [YYYY-MM-DD]
- **Period Covered**: [Sprint X / Project Y / Incident Z]
- **Participants**: [Number or list]
- **Facilitator**: [Name]

### Retrospective Format Used
- [ ] Start/Stop/Continue
- [ ] What went well/What didn't/Action items
- [ ] 4Ls (Liked/Learned/Lacked/Longed for)
- [ ] Sailboat (Wind/Anchors/Rocks/Island)
- [ ] Mad/Sad/Glad
- [ ] Timeline-based
- [ ] Other: ___________

---

## Retrospective Data

### What Went Well
[List items from the retrospective]
1.
2.
3.

### What Didn't Go Well / Challenges
[List items from the retrospective]
1.
2.
3.

### Ideas / Suggestions
[List items from the retrospective]
1.
2.
3.

### Action Items Identified
[List action items decided during retro]
1.
2.
3.

---

## Analysis Request

Please analyze this retrospective and generate:

### 1. Knowledge Entries
Identify learnings that should be documented in the knowledge base:
- Lessons learned
- Best practices discovered
- Troubleshooting solutions
- Process improvements

### 2. Process Improvements
Identify systematic improvements to propose:
- Workflow changes
- Tool adoptions
- Policy updates
- Communication improvements

### 3. Technical Debt Items
Identify technical work that should be tracked:
- Code quality issues
- Infrastructure improvements
- Testing gaps
- Documentation needs

### 4. Action Item Refinement
For each action item, provide:
- Clear description
- Owner suggestion
- Success criteria
- Recommended deadline

### 5. Cross-Team Sharing
Identify insights valuable to other teams:
- Generic lessons
- Reusable solutions
- Common pitfalls
```

---

## Example: Sprint Retrospective Analysis

```markdown
# Retrospective Insights Extraction

## Retrospective Context

### Event Details
- **Team**: Platform Team
- **Date**: 2024-01-19
- **Period Covered**: Sprint 23 (Jan 6-19)
- **Participants**: 6 (full team)
- **Facilitator**: Sarah

### Retrospective Format Used
- [x] What went well/What didn't/Action items

---

## Retrospective Data

### What Went Well
1. New monitoring dashboards helped catch issues early
2. Pair programming on complex auth changes reduced bugs
3. Daily async standups in Slack working better than meetings
4. Clear sprint goals kept us focused
5. Knowledge sharing sessions popular

### What Didn't Go Well / Challenges
1. Deployment to staging took 45 minutes, slowing iteration
2. Unclear requirements on SSO feature caused rework
3. Too many context switches from support tickets
4. Test environment was down for 2 days
5. Documentation for new APIs not done before handoff

### Ideas / Suggestions
1. Parallelize staging deployment pipeline
2. Require acceptance criteria review before sprint planning
3. Create support rotation to protect focus time
4. Add test environment health monitoring
5. Block PR merge without docs

### Action Items Identified
1. Investigate parallel deployment
2. Template for requirements with acceptance criteria
3. Propose support rotation to team lead
4. Add monitoring to test env
5. Add docs checklist to PR template

---

## Analysis Output

### 1. Knowledge Entries to Create

#### Entry 1: Effective Async Standups
**Type**: Best Practice
**Summary**: How we replaced synchronous standups with async Slack updates
**Key Points**:
- Daily post in #team-standups by 10am
- Format: Yesterday/Today/Blockers
- Threaded responses for follow-up
- Sync meeting only when blockers need discussion
**Why It Works**: Respects different schedules, creates searchable record, reduces meeting fatigue
**Tags**: process, communication, remote-work

#### Entry 2: Pair Programming for Complex Changes
**Type**: Best Practice
**Summary**: Using pair programming for high-risk code changes
**Key Points**:
- Identified auth module as complex area
- Scheduled pairing sessions (not ad-hoc)
- Reduced bugs in auth PRs by ~60%
- Knowledge distributed across team
**When to Use**: Security-critical code, unfamiliar areas, architectural changes
**Tags**: development, quality, collaboration

#### Entry 3: Early Detection with Custom Dashboards
**Type**: Lesson Learned
**Summary**: Building focused monitoring dashboards improved incident response
**Details**:
- Created service-specific dashboards (not just generic ones)
- Added business metric correlation
- Set up proactive alerts before user impact
- Cut MTTR by 40% this sprint
**Tags**: monitoring, operations, observability

---

### 2. Process Improvements to Propose

#### Improvement 1: Requirements Review Gate
**Problem**: Unclear requirements caused SSO feature rework
**Proposal**: Require acceptance criteria review before work begins
**Implementation**:
1. Create acceptance criteria template
2. Add review step to sprint planning
3. Product owner sign-off required
**Expected Benefit**: Reduce rework, clearer done criteria
**Owner**: Product owner + Tech lead

#### Improvement 2: Support Rotation System
**Problem**: Context switches from support tickets impacting focus
**Proposal**: Designated support person per day/week
**Implementation**:
1. Create rotation schedule
2. Define escalation criteria
3. Hand-off process between rotations
**Expected Benefit**: Protected focus time for 5/6 team members
**Owner**: Team lead to propose

#### Improvement 3: Documentation Required for Merge
**Problem**: APIs shipped without docs, causing downstream issues
**Proposal**: Add documentation checklist to PR template
**Implementation**:
1. Update PR template with docs section
2. Define what requires documentation
3. Reviewer responsible to check
**Expected Benefit**: Consistent documentation, faster integration
**Owner**: Tech lead

---

### 3. Technical Debt Items

#### Debt 1: Staging Deployment Pipeline
**Issue**: 45-minute deployments slowing iteration
**Impact**: Medium-High (multiple times per day)
**Proposed Solution**: Parallelize build steps, add caching
**Estimated Effort**: 1-2 sprints
**Ticket**: Create PLATFORM-XXX

#### Debt 2: Test Environment Reliability
**Issue**: Test env down for 2 days with no visibility
**Impact**: High (blocked all testing)
**Proposed Solution**: Add health monitoring and auto-recovery
**Estimated Effort**: 3-5 days
**Ticket**: Create PLATFORM-XXX

---

### 4. Refined Action Items

#### Action 1: Investigate Parallel Deployment
**Description**: Research and prototype parallelization of staging pipeline
**Owner**: DevOps engineer (suggested: Mike)
**Success Criteria**: Reduce deployment time to <15 minutes
**Deadline**: End of Sprint 24
**Priority**: High

#### Action 2: Create Requirements Template
**Description**: Draft template with acceptance criteria, review process
**Owner**: Product owner (with Tech lead input)
**Success Criteria**: Template approved, used for Sprint 25 planning
**Deadline**: Before Sprint 25 planning
**Priority**: High

#### Action 3: Propose Support Rotation
**Description**: Design rotation system, get team buy-in, implement
**Owner**: Team lead
**Success Criteria**: Rotation schedule published, team agreed
**Deadline**: Sprint 25
**Priority**: Medium

#### Action 4: Add Test Environment Monitoring
**Description**: Add health checks, alerts, and basic auto-recovery
**Owner**: Platform engineer (suggested: Jordan)
**Success Criteria**: Alerts fire before users notice, dashboard exists
**Deadline**: Sprint 24
**Priority**: High

#### Action 5: Update PR Template with Docs Checklist
**Description**: Add documentation requirements to PR template
**Owner**: Tech lead
**Success Criteria**: Template updated, team informed
**Deadline**: This week
**Priority**: Low (quick win)

---

### 5. Cross-Team Sharing Opportunities

#### Share with All Engineering
1. **Async Standup Format**: Other teams asking about our approach
2. **Monitoring Dashboard Patterns**: Reusable templates available
3. **Pair Programming Guidelines**: When and how to do it effectively

#### Share with Product Team
1. **Requirements Template**: They could adapt for other teams
2. **Sprint Goal Clarity**: What made our goals effective

#### Share with Leadership
1. **Focus Time Impact**: Data on context switching costs
2. **Documentation ROI**: Case for documentation requirements

---

### Summary

| Category | Count | Action Required |
|----------|-------|-----------------|
| Knowledge Entries | 3 | Create in Memory Bank |
| Process Improvements | 3 | Discuss and implement |
| Technical Debt | 2 | Create tickets |
| Action Items | 5 | Assign and track |
| Cross-Team Shares | 3 | Schedule sharing |
```

---

## Retrospective Patterns to Watch For

### Recurring Themes

```yaml
track_across_retros:
  - Issues that appear multiple times
  - Action items that don't get done
  - Positive patterns to reinforce
  - Environmental factors affecting team

actions:
  recurring_problems:
    - Escalate for structural solution
    - Allocate dedicated time to fix
    - Consider it technical debt

  undone_actions:
    - Understand why not completed
    - Make more specific or smaller
    - Assign clear ownership
```

### Health Indicators

```yaml
positive_signals:
  - Team celebrating wins together
  - Learnings being shared proactively
  - Problems being addressed systematically
  - Psychological safety in discussions

warning_signals:
  - Same problems every retro
  - Blame language appearing
  - Declining participation
  - Action items ignored
```

---

## Integration with Memory Bank

### Automated Capture

```yaml
after_retrospective:
  1_document:
    - Save full retro notes to archive
    - Create knowledge entries for learnings
    - Link action items to tickets

  2_track:
    - Add action items to tracking system
    - Set review reminders
    - Schedule follow-up

  3_share:
    - Post summary to team channel
    - Share cross-team insights
    - Update relevant docs
```

### Retrospective Archive

```yaml
location: "memory-bank/retrospectives/"

structure:
  YYYY/:
    - "sprint-XX-team-name.md"
    - "incident-XXX-postmortem.md"
    - "project-name-retro.md"

metadata:
  - Date
  - Team
  - Participants
  - Key themes
  - Action items status
```

---

## Best Practices

### For Facilitators

```yaml
do:
  - Create safe space for honesty
  - Ensure all voices heard
  - Focus on systems not people
  - Timebox discussions
  - End with concrete actions

dont:
  - Let discussion become venting
  - Allow blame or personal attacks
  - Skip the action planning
  - Over-commit on action items
  - Ignore patterns across retros
```

### For Action Items

```yaml
good_action_items:
  - Specific and measurable
  - Single owner assigned
  - Realistic deadline
  - Clear success criteria

poor_action_items:
  - "Improve communication"
  - "Be more careful"
  - "Fix the problem"
  - No owner assigned
```

### For Knowledge Capture

```yaml
capture_when:
  - Lesson is generalizable
  - Same issue might occur again
  - Other teams would benefit
  - Solution was non-obvious

format_for:
  - Searchability
  - Quick understanding
  - Easy application
  - Future reference
```

---

*Retrospectives are only valuable if insights lead to action. Systematic capture and follow-through transform periodic meetings into continuous improvement.*
