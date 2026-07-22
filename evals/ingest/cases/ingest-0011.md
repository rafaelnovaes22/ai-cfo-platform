---
case_id: "ingest-0011"
module: "ingest"
outcome: "ingest_partial"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0011 — Excel real com apenas 32 lançamentos válidos

## Input
- `source`: excel
- `payload`: XLSX da contadora com 32 linhas no mês 2026-04 + ~50 linhas em branco no final do sheet
- `tenantId`: "tenant-test-011"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 32,
  "orphanCount": 0,
  "outcome": "partial"
}
```

## Justificativa
0 < 32 < 50 → R2 (§1.2 / §1.6 ex.1). MonthlyAnalysis criado (pending), entries persistidas, classification NÃO enfileirada.

## Tags
real, xlsx, below-threshold, blank-trailing-rows
