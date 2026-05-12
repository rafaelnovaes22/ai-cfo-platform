---
case_id: "export-0007"
module: "export"
outcome: "report_exported_monthly"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0007 — Cross-tenant analysisId retorna 404 (não 403)

## Input (estado da análise)
- analysis pertence a tenant A (status delivered, dreJson present)
- request: GET /analysis/{idA}/export/monthly
- auth header: token de tenant B

## Ground truth
```yaml
expected_http_code: 404
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_FOUND"
expected_not_status: 403
expected_content_type_not: "application/pdf"
```

## Justificativa
§7.4 + C8: cross-tenant retorna 404 indistinguível de id inexistente — não vaza existência de recurso de outro tenant.

## Tags
cross-tenant, c8, 404-not-403
