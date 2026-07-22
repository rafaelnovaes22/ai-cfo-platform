---
case_id: "export-0013"
module: "export"
outcome: "report_exported_investors"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0013 — Investors happy path: lucro positivo + 8 KPIs completos

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { receitaBruta: 500000_00, lucroLiquido: 85000_00, ebitda: 120000_00, ... }
- analysis.narrativeCards: 3
- analysis.actionPlan: 9 actions (3 short / 3 medium / 3 long)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_filename_regex: "^aicfo-2026-04-investors\\.pdf$"
expected_content_length_min: 1024
expected_kpis_rendered: [receitaBruta, margemLiquida, lucroLiquido, ebitda, margemEbitda, totalImpactCents, cardTypeCounts, shortHorizonImpactCents]
```

## Justificativa
§5.2: investors deve renderizar 8 KPIs canônicos. Sumário executivo (headline + 1ª linha de cada card) + ações médio/longo.

## Tags
happy-path, kpis, lucro-positivo
