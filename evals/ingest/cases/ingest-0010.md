---
case_id: "ingest-0010"
module: "ingest"
outcome: "ingest_completed"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0010 — Re-import substitui dados anteriores (idempotência)

## Input
- `source`: excel
- `payload`: 80 linhas válidas para 2026-04, sendo o SEGUNDO upload do mesmo (tenantId, referenceMonth). Ingest anterior tinha 142 entries + narrativa + plano de ação.
- `tenantId`: "tenant-test-010"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<mesmo-ulid-anterior>",
  "entryCount": 80,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
Re-import idempotente (§1.4 e §1.5 ex.3): deleteMany ledger/narrative/actionPlan, reaproveita analysisId, persiste 80 novas, enfileira nova classification. R7 da test spec.

## Tags
edge, re-import, idempotency, replace-previous
