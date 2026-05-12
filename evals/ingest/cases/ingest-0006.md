---
case_id: "ingest-0006"
module: "ingest"
outcome: "ingest_completed"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0006 — Manual com 50 lançamentos (boundary exato)

## Input
- `source`: manual
- `payload`: JSON com 50 entries via POST /ingest/manual, todas com shape `{date, description, amount, direction}` válido
- `tenantId`: "tenant-test-006"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 50,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
Boundary exato: 50 == minEntries default → completed (R1; predicado `entries.length >= minEntries`).

## Tags
synthetic, manual, boundary-exact, threshold-50
