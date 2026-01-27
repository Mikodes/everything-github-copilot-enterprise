# Module Context: {{module_name}}

> Last Updated: {{date}}
> Status: {{status}} <!-- active | deprecated | planned | refactoring -->
> Owner: {{team_name}}

## Overview

**Module Name**: {{module_name}}

**Description**: {{description}}

**Domain**: {{business_domain}}

---

## Responsibilities

### This Module IS Responsible For:
- {{responsibility_1}}
- {{responsibility_2}}
- {{responsibility_3}}

### This Module is NOT Responsible For:
- {{not_responsible_1}}
- {{not_responsible_2}}

---

## Ubiquitous Language

| Term | Definition | Example |
|------|------------|---------|
| {{term_1}} | {{definition_1}} | {{example_1}} |
| {{term_2}} | {{definition_2}} | {{example_2}} |

---

## Structure

### Source Paths
- **Source Code**: `{{source_path}}`
- **Tests**: `{{test_path}}`

### Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| API/Controllers | `{{api_path}}` | HTTP endpoints, request/response handling |
| Application | `{{app_path}}` | Use cases, orchestration |
| Domain | `{{domain_path}}` | Business logic, entities |
| Infrastructure | `{{infra_path}}` | External services, persistence |

### Key Files

| File | Description | Importance |
|------|-------------|------------|
| `{{key_file_1}}` | {{key_file_1_desc}} | Critical |
| `{{key_file_2}}` | {{key_file_2_desc}} | Important |

---

## Domain Model

### Aggregates

#### {{aggregate_name}}
- **Root Entity**: `{{aggregate_root}}`
- **Entities**: {{entities}}
- **Value Objects**: {{value_objects}}

### Domain Events Published
| Event | Description | Trigger |
|-------|-------------|---------|
| `{{event_1}}` | {{event_1_desc}} | {{event_1_trigger}} |

### Domain Events Subscribed
| Event | Source | Handler |
|-------|--------|---------|
| `{{subscribed_event_1}}` | {{source_module}} | `{{handler_class}}` |

---

## Dependencies

### Internal Dependencies (Other Modules)
| Module | Type | Description |
|--------|------|-------------|
| {{dep_module_1}} | {{dep_type_1}} | {{dep_desc_1}} |

### External Dependencies
| Service | Type | Critical? | Description |
|---------|------|-----------|-------------|
| {{ext_service_1}} | {{ext_type_1}} | {{critical_1}} | {{ext_desc_1}} |

---

## API Contracts

### Exposed APIs

#### {{api_name}}
- **Type**: {{api_type}} <!-- REST | gRPC | GraphQL | Event -->
- **Path**: `{{api_path}}`
- **Schema**: `{{schema_path}}`
- **Consumers**: {{consumers}}

### Consumed APIs
| API | Provider | Type | Description |
|-----|----------|------|-------------|
| {{consumed_api_1}} | {{provider_1}} | {{type_1}} | {{desc_1}} |

---

## Testing Strategy

### Approach
{{testing_approach}}

### Coverage
- **Current**: {{current_coverage}}%
- **Target**: {{target_coverage}}%

### Critical Paths (Must Always Be Tested)
1. {{critical_path_1}}
2. {{critical_path_2}}

### Test Data Setup
{{test_data_instructions}}

---

## Security Considerations

### Data Classification
{{data_classification}} <!-- public | internal | confidential | restricted -->

### Authentication Required
{{auth_required}} <!-- Yes | No -->

### Required Permissions
- {{permission_1}}
- {{permission_2}}

### Sensitive Operations
| Operation | Risk | Mitigation |
|-----------|------|------------|
| {{sensitive_op_1}} | {{risk_1}} | {{mitigation_1}} |

---

## Performance

### SLA
- **Response Time**: {{response_time_sla}}
- **Throughput**: {{throughput_sla}}
- **Availability**: {{availability_sla}}

### Known Bottlenecks
| Issue | Description | Mitigation |
|-------|-------------|------------|
| {{bottleneck_1}} | {{bottleneck_1_desc}} | {{bottleneck_1_mitigation}} |

### Scaling Strategy
{{scaling_strategy}}

---

## Changelog

| Date | Version | Change | Breaking? | Author |
|------|---------|--------|-----------|--------|
| {{date_1}} | {{version_1}} | {{change_1}} | {{breaking_1}} | {{author_1}} |

---

## Related Decisions

- [ADR-{{adr_1}}](../../decisions/{{adr_1}}.md) - {{adr_1_title}}
- [ADR-{{adr_2}}](../../decisions/{{adr_2}}.md) - {{adr_2_title}}

---

## Notes

{{additional_notes}}
