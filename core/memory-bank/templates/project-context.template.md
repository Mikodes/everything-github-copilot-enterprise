# Project Context

> Last Updated: {{date}}
> Version: {{version}}

## Overview

**Project Name**: {{project_name}}

**Description**: {{description}}

**Status**: {{status}} <!-- development | staging | production | maintenance -->

---

## Business Domain

### Industry
{{industry}}

### Primary Function
{{primary_function}}

### Target Users
- {{user_type_1}}
- {{user_type_2}}

### Critical Features
1. {{feature_1}}
2. {{feature_2}}
3. {{feature_3}}

---

## Technical Stack

### Primary Language & Framework
- **Language**: {{language}} {{language_version}}
- **Framework**: {{framework}} {{framework_version}}
- **Runtime**: {{runtime}} {{runtime_version}}

### Database
- **Type**: {{database_type}}
- **Version**: {{database_version}}
- **ORM**: {{orm}}

### Infrastructure
- **Cloud Provider**: {{cloud_provider}}
- **Container Platform**: {{container_platform}}
- **Orchestration**: {{orchestration}}

### Build Tools
- **Build Tool**: {{build_tool}}
- **Package Manager**: {{package_manager}}

---

## Architecture

### Style
{{architecture_style}} <!-- monolith | modular-monolith | microservices | serverless -->

### Pattern
{{architecture_pattern}} <!-- layered | hexagonal | clean | cqrs | event-sourcing -->

### Modules/Bounded Contexts

| Module | Responsibility | Context Path |
|--------|---------------|--------------|
| {{module_1}} | {{responsibility_1}} | `.memory-bank/modules/{{module_1}}/` |
| {{module_2}} | {{responsibility_2}} | `.memory-bank/modules/{{module_2}}/` |

---

## Development Workflow

### Repository
- **URL**: {{repo_url}}
- **Default Branch**: {{default_branch}}
- **Branching Strategy**: {{branching_strategy}}

### CI/CD
- **Platform**: {{cicd_platform}}
- **Pipeline Path**: {{pipeline_path}}

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | {{dev_url}} | Local development |
| Staging | {{staging_url}} | Pre-production testing |
| Production | {{prod_url}} | Live environment |

---

## Quality Standards

### Test Coverage
- **Minimum**: {{min_coverage}}%
- **Target**: {{target_coverage}}%

### Code Quality
- **SonarQube Project**: {{sonar_project_key}}
- **Quality Gate**: {{quality_gate}}

### Security
- **SAST Tool**: {{sast_tool}}
- **DAST Tool**: {{dast_tool}}
- **Dependency Scanning**: {{dependency_scanning}}

---

## Integrations

### Project Management
- **Tool**: {{pm_tool}} <!-- jira | azure-devops | github-issues -->
- **Project Key**: {{pm_project_key}}

### Documentation
- **Tool**: {{doc_tool}} <!-- confluence | notion | github-wiki -->
- **Space/Location**: {{doc_location}}

### Communication
- **Tool**: {{comm_tool}}
- **Main Channel**: {{main_channel}}

---

## Team Conventions

### Commit Format
{{commit_format}} <!-- conventional | angular | custom -->

Example: `{{commit_example}}`

### PR Template
See `.github/PULL_REQUEST_TEMPLATE.md`

### Code Style
See `{{code_style_guide_path}}`

---

## Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Tech Lead | {{tech_lead}} | {{tech_lead_email}} |
| Product Owner | {{po}} | {{po_email}} |
| Architect | {{architect}} | {{architect_email}} |

---

## Notes

{{additional_notes}}

---

## Quick Links

- [Architecture Documentation]({{arch_doc_link}})
- [API Documentation]({{api_doc_link}})
- [Runbook]({{runbook_link}})
- [Monitoring Dashboard]({{monitoring_link}})
