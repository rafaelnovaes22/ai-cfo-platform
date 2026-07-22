---
case_id: "ingest-0033"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0033 — Primeiro POST /ingest/manual cria analysisId

## Input
- `source`: manual
- `payload`: 50 entries JSON via POST /ingest/manual, par (tenantId, referenceMonth) inexistente
- `tenantId`: "tenant-test-033"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 50,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called once"
}
```

## Justificativa
§1.4: caminho /ingest/manual igualmente dispara new_analysis_triggered.

## Tags
real, manual, side-effect, new-analysis-via-manual
