# Troubleshooting: {{title}}

- **ID**: {{KB_ID}}
- **Status**: {{status}} <!-- draft | published | deprecated | needs-review -->
- **Severity**: {{severity}} <!-- low | medium | high | critical -->
- **Frequency**: {{frequency}} <!-- rare | occasional | frequent | common -->
- **Created**: {{created_date}}
- **Last Verified**: {{verified_date}}
- **Author**: {{author_name}} (@{{author_github}})

---

## Problem Summary

{{problem_summary}}

---

## Symptoms

### What You'll See
- {{symptom_1}}
- {{symptom_2}}
- {{symptom_3}}

### Error Messages

```
{{error_message_1}}
```

```
{{error_message_2}}
```

### Where It Occurs
- **Environment**: {{affected_environments}} <!-- development | staging | production | all -->
- **Modules**: {{affected_modules}}
- **Conditions**: {{occurrence_conditions}}

---

## Root Cause

{{root_cause_explanation}}

### Why This Happens
{{detailed_cause_explanation}}

### Contributing Factors
- {{contributing_factor_1}}
- {{contributing_factor_2}}

---

## Quick Fix

> **TL;DR**: {{quick_fix_summary}}

```{{language}}
{{quick_fix_code}}
```

---

## Detailed Solution

### Step 1: Diagnose the Issue

{{diagnose_description}}

```{{language}}
{{diagnose_command}}
```

**Expected output if this is the issue:**
```
{{expected_diagnostic_output}}
```

### Step 2: {{solution_step_2_title}}

{{solution_step_2_description}}

```{{language}}
{{solution_step_2_code}}
```

### Step 3: {{solution_step_3_title}}

{{solution_step_3_description}}

```{{language}}
{{solution_step_3_code}}
```

### Step 4: Verify the Fix

{{verify_description}}

```{{language}}
{{verify_command}}
```

**Expected output after fix:**
```
{{expected_output_after_fix}}
```

---

## Alternative Solutions

### Alternative 1: {{alternative_1_title}}

**When to use**: {{alternative_1_when}}

{{alternative_1_description}}

```{{language}}
{{alternative_1_code}}
```

**Pros**: {{alternative_1_pros}}
**Cons**: {{alternative_1_cons}}

### Alternative 2: {{alternative_2_title}}

**When to use**: {{alternative_2_when}}

{{alternative_2_description}}

---

## Prevention

### How to Prevent This Issue

1. {{prevention_1}}
2. {{prevention_2}}
3. {{prevention_3}}

### Recommended Configuration

```{{language}}
{{recommended_config}}
```

### Monitoring/Alerting

{{monitoring_recommendations}}

---

## Impact Assessment

### What's Affected
- {{impact_1}}
- {{impact_2}}

### Business Impact
{{business_impact}}

### Time to Resolution
- **With this guide**: {{time_with_guide}}
- **Without this guide**: {{time_without_guide}}

---

## Related Issues

| Type | ID | Title | Status |
|------|----|----|--------|
| {{issue_type_1}} | [{{issue_id_1}}]({{issue_url_1}}) | {{issue_title_1}} | {{issue_status_1}} |

### Related Pull Requests
- {{related_pr_1}}

---

## Similar Problems

These issues may appear similar but have different causes:

| Problem | Key Difference | Link |
|---------|---------------|------|
| {{similar_problem_1}} | {{key_difference_1}} | [{{similar_kb_1}}](./{{similar_kb_1}}.md) |

---

## Context

### Applies To
- **Stack**: {{applicable_stack}}
- **Framework Version**: {{framework_version}}
- **Runtime Version**: {{runtime_version}}

### First Reported
- **Date**: {{first_reported_date}}
- **Version**: {{version_first_reported}}
- **Reporter**: {{first_reporter}}

### Resolution History
| Date | Version | Resolution | Notes |
|------|---------|------------|-------|
| {{resolution_date_1}} | {{resolution_version_1}} | {{resolution_type_1}} | {{resolution_notes_1}} |

---

## References

### Documentation
- [{{doc_reference_1}}]({{doc_url_1}})

### Stack Overflow / Community
- [{{so_reference_1}}]({{so_url_1}})

### Vendor Resources
- [{{vendor_reference_1}}]({{vendor_url_1}})

---

## Tags

`{{tag_1}}` `{{tag_2}}` `{{tag_3}}` `troubleshooting`

---

## Search Keywords

{{keyword_1}}, {{keyword_2}}, {{keyword_3}}, {{error_message_keyword}}

---

## Verification Status

- [ ] Verified in Development
- [ ] Verified in Staging
- [ ] Verified in Production
- [ ] Peer Reviewed

**Last Verified By**: {{verifier}} on {{verification_date}}

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| {{change_date_1}} | {{change_author_1}} | {{change_description_1}} |

---

## Notes

{{additional_notes}}

---

## Escalation

If this guide doesn't resolve your issue:

1. **Check**: Have you tried all alternative solutions?
2. **Gather**: Collect logs from `{{log_location}}`
3. **Contact**: {{escalation_contact}}
4. **Include**:
   - This KB ID: {{KB_ID}}
   - Error messages
   - Steps already tried
   - Environment details
