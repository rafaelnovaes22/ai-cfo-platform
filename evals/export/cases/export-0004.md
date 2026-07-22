---
case_id: "export-0004"
module: "export"
outcome: "report_exported_monthly"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0004 — Status generating bloqueia export

## Input (estado da análise)
- analysis.status: "generating"
- analysis.mode: "assisted"
- analysis.dreJson: null (pipeline em execução)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "status=generating"
```

## Justificativa
Status `generating` significa pipeline rodando — análise ainda não consolidada. Gate mecânico antes do generator.

## Tags
status-gate, generating, in-flight
