---
case_id: "ingest-0004"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0004 — Excel manual da contadora com 95 lançamentos

## Input
- `source`: excel
- `payload`: XLSX criado manualmente pela contadora, headers `Data | Histórico | Débito | Crédito` (duas colunas de valor), 95 linhas no mês 2026-04, valores BR
- `tenantId`: "tenant-test-004"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 95,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
95 ≥ 50; detecção de colunas separadas débito/crédito mapeia para `direction` corretamente → R1.

## Tags
real, xlsx, contadora-manual, debito-credito-split
