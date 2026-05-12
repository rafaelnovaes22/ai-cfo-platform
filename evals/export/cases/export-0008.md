---
case_id: "export-0008"
module: "export"
outcome: "report_exported_monthly"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0008 — analysisId inexistente retorna 404

## Input (estado da análise)
- analysisId: "00000000-0000-0000-0000-000000000000" (UUID válido mas inexistente)
- request: GET /analysis/{id}/export/monthly
- auth: tenant válido

## Ground truth
```yaml
expected_http_code: 404
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_FOUND"
expected_content_disposition: undefined
```

## Justificativa
404 resposta idêntica ao cross-tenant (C8) — não vazar distinção entre "não existe" e "existe mas não é seu".

## Tags
not-found, 404, c8
