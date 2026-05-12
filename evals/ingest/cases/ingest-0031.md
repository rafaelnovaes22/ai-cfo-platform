---
case_id: "ingest-0031"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0031 — Primeiro upload de tenant cria MonthlyAnalysis (pending)

## Input
- `source`: excel
- `payload`: XLSX 142 linhas, primeiro POST /ingest/upload do par (tenantId, referenceMonth=2026-04). Não há MonthlyAnalysis prévio
- `tenantId`: "tenant-test-031"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 142,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called once with status='pending'"
}
```

## Justificativa
§1.4: primeiro ingest válido para (tenantId, referenceMonth) cria registro MonthlyAnalysis status=pending. `createMock` chamado 1x, `deleteMany` não.

## Tags
real, xlsx, side-effect, first-ingest, new-analysis
