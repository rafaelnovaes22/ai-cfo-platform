---
case_id: "ingest-0032"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0032 — Primeiro POST /ingest/clipboard cria analysisId

## Input
- `source`: text
- `payload`: 67 linhas TSV via POST /ingest/clipboard, novo par (tenantId, referenceMonth)
- `tenantId`: "tenant-test-032"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 67,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called once"
}
```

## Justificativa
§1.4: criação não é exclusiva de /ingest/upload — qualquer endpoint válido (upload|clipboard|manual) cria a análise.

## Tags
real, clipboard, side-effect, new-analysis-via-clipboard
