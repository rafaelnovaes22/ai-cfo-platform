---
case_id: "ingest-0016"
module: "ingest"
outcome: "ingest_partial"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0016 — CSV com 1 linha válida (mínimo absoluto > 0)

## Input
- `source`: csv
- `payload`: CSV header + 1 única linha válida
- `tenantId`: "tenant-test-016"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 1,
  "orphanCount": 0,
  "outcome": "partial"
}
```

## Justificativa
1 > 0 E 1 < 50 → R2 (boundary mínimo da faixa partial; predicado `entries.length > 0`).

## Tags
synthetic, csv, single-entry, boundary-min
