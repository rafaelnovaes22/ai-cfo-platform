---
case_id: "ingest-0005"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0005 — Clipboard colado do Google Sheets, 67 lançamentos

## Input
- `source`: text
- `payload`: 67 linhas TSV coladas do Google Sheets, header `Data\tDescrição\tValor\tTipo`, encoding UTF-8, valores BR
- `tenantId`: "tenant-test-005"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 67,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
67 ≥ 50, parseText detecta TSV via tab-separator, shape válido → R1 (§1.5 ex. 2).

## Tags
real, clipboard, gsheets, tsv
