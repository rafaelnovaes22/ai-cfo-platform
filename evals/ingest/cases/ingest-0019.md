---
case_id: "ingest-0019"
module: "ingest"
outcome: "ingest_partial"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0019 — Manual com 30 entries válidas e 5 com direction inválida

## Input
- `source`: manual
- `payload`: POST /ingest/manual com 35 entries — 30 válidas, 5 com `direction: "transfer"` (enum inválido)
- `tenantId`: "tenant-test-019"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 30,
  "orphanCount": 5,
  "outcome": "partial"
}
```

## Justificativa
30 < 50 E orphanCount > 0 → R2. Direction inválida cai em órfão (test spec parsers-manual).

## Tags
synthetic, manual, invalid-direction-enum, orphan
