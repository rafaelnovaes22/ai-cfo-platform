---
case_id: "ingest-0024"
module: "ingest"
outcome: "ingest_failed"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0024 — Arquivo vazio (0 bytes)

## Input
- `source`: csv
- `payload`: arquivo CSV de 0 bytes uploadado via multipart
- `tenantId`: "tenant-test-024"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": null,
  "entryCount": 0,
  "orphanCount": 0,
  "outcome": "failed"
}
```

## Justificativa
entries.length === 0 → R3 (§1.3 cláusula b).

## Tags
synthetic, empty-file, zero-bytes
