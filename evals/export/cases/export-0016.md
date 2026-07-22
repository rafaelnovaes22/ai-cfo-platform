---
case_id: "export-0016"
module: "export"
outcome: "report_exported_investors"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0016 — Investors status=generating bloqueia

## Input (estado da análise)
- analysis.status: "generating"
- analysis.dreJson: null
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "status=generating"
```

## Justificativa
§1.2 exemplo negativo 1: status=generating retorna 422. Gate mecânico independente do sabor.

## Tags
status-gate, generating, investors
