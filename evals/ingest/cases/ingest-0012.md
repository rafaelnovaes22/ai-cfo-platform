---
case_id: "ingest-0012"
module: "ingest"
outcome: "ingest_partial"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0012 — CSV com 60 linhas mas 15 órfãs (descrições vazias)

## Input
- `source`: csv
- `payload`: CSV real com 60 linhas — 45 válidas e 15 com campo descrição vazio (extrato parcialmente formatado)
- `tenantId`: "tenant-test-012"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 45,
  "orphanCount": 15,
  "outcome": "partial"
}
```

## Justificativa
45 < 50 E orphanCount > 0 → R2 dupla justificativa. Predicado: `entries.length > 0 && (entries.length < minEntries || orphanCount > 0)`.

## Tags
real, csv, orphan-count, empty-description
