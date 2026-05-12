---
case_id: "export-0021"
module: "export"
outcome: "report_exported_investors"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0021 — Investors cross-tenant retorna 404

## Input (estado da análise)
- analysis pertence a tenant A (status delivered)
- request: GET /analysis/{idA}/export/investors
- auth: token de tenant B

## Ground truth
```yaml
expected_http_code: 404
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_FOUND"
expected_content_disposition: undefined
```

## Justificativa
§7.4 + C8: cross-tenant é 404 em todos os sabores. Não vazar existência inter-tenant.

## Tags
cross-tenant, c8, investors
