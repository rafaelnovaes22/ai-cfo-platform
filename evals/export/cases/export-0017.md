---
case_id: "export-0017"
module: "export"
outcome: "report_exported_investors"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0017 — Investors com ebitda ausente renderiza "n/a" mas conta outcome

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { receitaBruta: 300000_00, lucroLiquido: 20000_00 }  # sem campo ebitda (drift)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_ebitda_rendered: "n/a"
expected_margemEbitda_rendered: "n/a"
```

## Justificativa
§1.2 exemplo negativo 2: campo ausente vira `n/a` no PDF; outcome conta. Falha imputada ao `dre-narrative`, não ao export.

## Tags
dre-drift, n/a-fallback, robusto
