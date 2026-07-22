---
case_id: "ingest-0037"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0037 — Ingest_partial também dispara new_analysis_triggered

## Input
- `source`: csv
- `payload`: primeiro upload do par, 30 linhas válidas (abaixo do threshold), nenhum MonthlyAnalysis prévio
- `tenantId`: "tenant-test-037"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 30,
  "orphanCount": 0,
  "outcome": "partial",
  "side_effect": "monthlyAnalysis.create called once (status=pending); enqueueClassification NOT called"
}
```

## Justificativa
§1.2 + §1.4: análise é criada mesmo no caminho partial. Só `ingest_failed` (caminho de exceção sem entries) não dispara new_analysis_triggered nesta semântica — em partial, agrega persistido.

## Tags
edge, partial, side-effect, new-analysis-on-partial
