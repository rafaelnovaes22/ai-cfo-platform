---
case_id: "export-0003"
module: "export"
outcome: "report_exported_monthly"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0003 — Status ready (SHADOW) bloqueia export (C4)

## Input (estado da análise)
- analysis.status: "ready"
- analysis.mode: "shadow"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "status=ready"
expected_exportable_statuses: ["delivered", "approved"]
```

## Justificativa
Fix Onda A (commit 2e44531): EXPORTABLE_STATUS = [delivered, approved]. Tenant SHADOW nunca passa de ready → bloqueio mecânico de C4.

## Tags
status-gate, shadow-mode, c4-enforcement
