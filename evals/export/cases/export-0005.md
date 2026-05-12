---
case_id: "export-0005"
module: "export"
outcome: "report_exported_monthly"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0005 — Status pending bloqueia export

## Input (estado da análise)
- analysis.status: "pending"
- analysis.mode: "assisted"
- analysis.dreJson: null
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "status=pending"
```

## Justificativa
Status `pending` = análise criada mas pipeline não iniciou. Gate mecânico bloqueia antes de qualquer renderização.

## Tags
status-gate, pending
