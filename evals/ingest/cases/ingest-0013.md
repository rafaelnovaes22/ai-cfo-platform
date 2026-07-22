---
case_id: "ingest-0013"
module: "ingest"
outcome: "ingest_partial"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0013 — Boundary minEntries - 1 (49 lançamentos válidos)

## Input
- `source`: manual
- `payload`: JSON com exatamente 49 entries válidas via POST /ingest/manual
- `tenantId`: "tenant-test-013"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 49,
  "orphanCount": 0,
  "outcome": "partial"
}
```

## Justificativa
Boundary inferior: 49 == minEntries - 1 → predicado `entries.length < minEntries` cai em partial. R2 (§1.2).

## Tags
edge, manual, boundary-minus-one, threshold-49
