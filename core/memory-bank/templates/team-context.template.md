# Team Context: {{team_name}}

> Last Updated: {{date}}
> Status: {{status}} <!-- active | forming | reorganizing | disbanded -->
> Type: {{team_type}} <!-- feature | platform | enablement | stream-aligned | complicated-subsystem -->

## Overview

**Team Name**: {{team_name}}

**Mission**: {{team_mission}}

**Department**: {{department}}

**Location**: {{location}} <!-- e.g., "Madrid, Spain" or "Distributed" -->

**Primary Timezone**: {{timezone}}

---

## Team Members

| Name | Role | Seniority | Expertise | GitHub | Availability |
|------|------|-----------|-----------|--------|--------------|
| {{member_1_name}} | {{member_1_role}} | {{member_1_seniority}} | {{member_1_expertise}} | @{{member_1_github}} | {{member_1_availability}} |
| {{member_2_name}} | {{member_2_role}} | {{member_2_seniority}} | {{member_2_expertise}} | @{{member_2_github}} | {{member_2_availability}} |

### Key Roles

| Role | Person | Contact | Since |
|------|--------|---------|-------|
| Tech Lead | {{tech_lead}} | {{tech_lead_email}} | {{tech_lead_since}} |
| Product Owner | {{product_owner}} | {{po_email}} | {{po_since}} |
| Scrum Master | {{scrum_master}} | {{sm_email}} | {{sm_since}} |

---

## Responsibilities

### Modules/Services We Own
- {{owned_module_1}}
- {{owned_module_2}}

### Modules/Services We Maintain
- {{maintained_module_1}}

### Modules/Services We Contribute To
- {{contributed_module_1}}

---

## Expertise & Tech Stack

### Primary Expertise
- {{primary_expertise_1}}
- {{primary_expertise_2}}

### Technologies We Use
| Category | Primary | Secondary | Phasing Out |
|----------|---------|-----------|-------------|
| Languages | {{primary_lang}} | {{secondary_lang}} | {{deprecated_lang}} |
| Frameworks | {{primary_framework}} | {{secondary_framework}} | - |
| Databases | {{primary_db}} | {{secondary_db}} | - |
| Cloud | {{cloud_provider}} | - | - |

### Currently Learning
- {{learning_1}}
- {{learning_2}}

---

## Working Agreements

### Core Hours
{{core_hours}} <!-- e.g., "10:00 - 16:00 CET" -->

### Regular Meetings

| Meeting | Frequency | Day | Time | Duration | Purpose |
|---------|-----------|-----|------|----------|---------|
| Daily Standup | Daily | Mon-Fri | {{standup_time}} | 15 min | Sync & blockers |
| Sprint Planning | {{sprint_frequency}} | {{planning_day}} | {{planning_time}} | {{planning_duration}} | Plan sprint |
| Retrospective | {{retro_frequency}} | {{retro_day}} | {{retro_time}} | {{retro_duration}} | Continuous improvement |
| Refinement | Weekly | {{refinement_day}} | {{refinement_time}} | 1 hour | Backlog grooming |

### Response Time Expectations

| Channel | Expected Response |
|---------|-------------------|
| Slack/Teams | {{slack_response_time}} |
| Email | {{email_response_time}} |
| Code Review | {{code_review_sla}} |
| Critical Issues | {{critical_response_time}} |

### On-Call

- **Rotation**: {{oncall_rotation}} <!-- weekly | bi-weekly | monthly -->
- **Schedule**: [On-Call Schedule]({{oncall_schedule_link}})
- **Escalation**: {{escalation_procedure}}

---

## Development Practices

### Methodology
{{methodology}} <!-- scrum | kanban | scrumban | xp -->

### Sprint Length
{{sprint_length}} days

### Branching Strategy
{{branching_strategy}} <!-- gitflow | github-flow | trunk-based -->

### Code Review
- **Required**: {{code_review_required}} <!-- Yes | No -->
- **Minimum Approvals**: {{min_approvals}}
- **Auto-Assign**: {{auto_assign_reviewers}} <!-- Yes | No -->
- **SLA**: {{review_sla_hours}} hours

### Other Practices
- **Pair Programming**: {{pair_programming}} <!-- Encouraged | Optional | Required for complex tasks -->
- **TDD**: {{tdd_practiced}} <!-- Yes | No | Encouraged -->
- **Feature Flags**: {{feature_flags}} <!-- Yes | No -->
- **Deploy Frequency**: {{deploy_frequency}}

---

## Quality Standards

### Test Coverage
- **Minimum**: {{min_coverage}}%
- **Target**: {{target_coverage}}%

### Code Quality
- **Linting**: {{linting_enforced}} <!-- Required | Recommended -->
- **Static Analysis**: {{static_analysis}} <!-- SonarQube | Other | None -->
- **Quality Gate**: {{quality_gate}}

### Documentation Requirements
| Type | Requirement |
|------|-------------|
| API Documentation | {{api_docs_requirement}} <!-- Required | Encouraged | Optional -->
| ADRs | {{adr_requirement}} |
| README | {{readme_requirement}} |

---

## Communication

### Channels

| Platform | Channel | Purpose |
|----------|---------|---------|
| {{platform_1}} | {{channel_1}} | {{purpose_1}} |
| {{platform_2}} | {{channel_2}} | {{purpose_2}} |

### Key Links
- **Announcements**: {{announcements_channel}}
- **Incidents**: {{incidents_channel}}

---

## Dependencies

### Teams We Depend On (Upstream)

| Team | Interaction Type | What For |
|------|-----------------|----------|
| {{upstream_team_1}} | {{interaction_type_1}} | {{dependency_desc_1}} |

### Teams That Depend On Us (Downstream)

| Team | Interaction Type | What For |
|------|-----------------|----------|
| {{downstream_team_1}} | {{interaction_type_2}} | {{dependency_desc_2}} |

---

## Onboarding

### New Member Checklist

| Task | Owner | Duration | Resources |
|------|-------|----------|-----------|
| Environment setup | New member | {{env_setup_duration}} | [Setup Guide]({{setup_guide_link}}) |
| Codebase walkthrough | Buddy | {{walkthrough_duration}} | This Memory Bank |
| Access requests | Tech Lead | {{access_duration}} | [Access Request]({{access_request_link}}) |
| First PR | New member | {{first_pr_duration}} | Good first issues |
| Architecture overview | Architect | {{arch_overview_duration}} | [Architecture Docs]({{arch_docs_link}}) |

### Current Onboarding Buddy
{{onboarding_buddy}}

### Useful Resources
- [Team Wiki]({{wiki_link}})
- [Architecture Documentation]({{arch_doc_link}})
- [Coding Standards]({{coding_standards_link}})
- [Common Issues]({{common_issues_link}})

### Expected Ramp-Up Time
{{expected_rampup}} <!-- e.g., "4-6 weeks to full productivity" -->

---

## Metrics (DORA)

| Metric | Current | Target |
|--------|---------|--------|
| Deployment Frequency | {{deploy_frequency_current}} | {{deploy_frequency_target}} |
| Lead Time for Changes | {{lead_time_current}} | {{lead_time_target}} |
| Mean Time to Recovery | {{mttr_current}} | {{mttr_target}} |
| Change Failure Rate | {{cfr_current}} | {{cfr_target}} |

### Velocity
- **Average**: {{average_velocity}} {{velocity_unit}}

---

## Tools & Links

### Tools We Use

| Purpose | Tool | Link |
|---------|------|------|
| Project Management | {{pm_tool}} | [Board]({{board_link}}) |
| Documentation | {{doc_tool}} | [Wiki]({{wiki_link}}) |
| Code Repository | {{repo_tool}} | [Repo]({{repo_link}}) |
| CI/CD | {{cicd_tool}} | [Pipelines]({{cicd_link}}) |
| Monitoring | {{monitoring_tool}} | [Dashboard]({{monitoring_link}}) |
| Logging | {{logging_tool}} | [Logs]({{logging_link}}) |

### Quick Links
- [Team Dashboard]({{dashboard_link}})
- [Runbook]({{runbook_link}})
- [Incident Management]({{incident_link}})

---

## Notes

{{additional_notes}}
