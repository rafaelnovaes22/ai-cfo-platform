---
case_id: "ingest-0034"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0034 — Mesmo tenant, mês diferente cria nova análise

## Input
- `source`: excel
- `payload`: tenant já possui MonthlyAnalysis para 2026-03; novo upload para 2026-04 (mês diferente)
- `tenantId`: "tenant-test-034"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-different-from-2026-03>",
  "entryCount": 80,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called once for 2026-04 (independent from 2026-03)"
}
```

## Justificativa
§1.4: a unicidade é pelo PAR (tenantId, referenceMonth). Novo mês = nova análise. Garante índice composto.

## Tags
synthetic, multi-month, side-effect, independent-analysis
