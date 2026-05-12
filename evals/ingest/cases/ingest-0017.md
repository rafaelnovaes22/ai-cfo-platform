---
case_id: "ingest-0017"
module: "ingest"
outcome: "ingest_partial"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0017 — PDF do contador com 40 transações extraídas

## Input
- `source`: pdf
- `payload`: PDF de balancete simplificado do contador (texto-selecionável), 40 lançamentos legíveis
- `tenantId`: "tenant-test-017"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 40,
  "orphanCount": 0,
  "outcome": "partial"
}
```

## Justificativa
40 < 50 → R2. PDF parse OK mas volume insuficiente para enfileirar classification.

## Tags
real, pdf, balancete, below-threshold
