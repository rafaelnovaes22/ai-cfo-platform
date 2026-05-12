---
case_id: "export-0014"
module: "export"
outcome: "report_exported_investors"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0014 — Investors com lucro negativo: relato fiel (sem ocultar)

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { receitaBruta: 200000_00, lucroLiquido: -15000_00, ebitda: -8000_00 }
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_content_length_min: 1024
expected_negative_values_visible: true
expected_no_value_masking: true
```

## Justificativa
§1.2 exemplo positivo 2: ebitda/lucro negativos NÃO ocultam — flag visual vermelha mas valor exibido. Outcome conta (relato fiel da situação).

## Tags
lucro-negativo, ebitda-negativo, relato-fiel
