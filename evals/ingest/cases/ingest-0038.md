---
case_id: "ingest-0038"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0038 — Ingest_failed NÃO cria MonthlyAnalysis se não existia

## Input
- `source`: pdf
- `payload`: PDF escaneado (failed), nenhum MonthlyAnalysis prévio para o par
- `tenantId`: "tenant-test-038"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": null,
  "entryCount": 0,
  "orphanCount": 0,
  "outcome": "failed",
  "side_effect": "monthlyAnalysis.create NOT called"
}
```

## Justificativa
§1.3: failed retorna analysisId=null e nada é persistido. new_analysis_triggered ausente. Garante que falha de parse não polui DB.

## Tags
edge, failed, side-effect-absent, no-pollution
