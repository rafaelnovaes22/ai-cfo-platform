---
case_id: "ingest-0036"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0036 — Segundo ingest para mesmo par NÃO cria nova análise (reaproveita)

## Input
- `source`: excel
- `payload`: SEGUNDO upload de XLSX para (tenant, 2026-04) — análise existente tem id "analysis-X" com 142 entries
- `tenantId`: "tenant-test-036"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "analysis-X",
  "entryCount": 80,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create NOT called; update status=pending called; 3 deleteMany (ledger, narrative, actionPlan)"
}
```

## Justificativa
§1.4 contrapositiva: "Subsequentes chamadas para o mesmo par não criam nova análise". new_analysis_triggered NÃO ocorre — predicado de tx.monthlyAnalysis.create não é executado.

## Tags
edge, re-import, side-effect-negation, no-new-analysis
