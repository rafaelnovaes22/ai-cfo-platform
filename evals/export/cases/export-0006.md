---
case_id: "export-0006"
module: "export"
outcome: "report_exported_monthly"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0006 — dreJson null retorna 422 com reason dre_not_ready

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.mode: "assisted"
- analysis.dreJson: null (drift do pipeline — análise marcada delivered mas DRE corrompido)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "dre_not_ready"
```

## Justificativa
§7.1: dreJson null → 422 explícito. Não tenta renderizar PDF parcial. Defesa contra drift de pipeline.

## Tags
dre-null, status-gate, pipeline-drift
