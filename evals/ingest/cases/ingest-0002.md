---
case_id: "ingest-0002"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0002 — CSV real do Nibo com 87 lançamentos

## Input
- `source`: csv
- `payload`: CSV exportado do Nibo, separador `;` (BR default), 87 linhas + header `Data;Descrição;Valor;Tipo`, encoding UTF-8
- `tenantId`: "tenant-test-002"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 87,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
87 ≥ 50, shape válido, separador `;` detectado corretamente pelo papaparse → R1.

## Tags
real, csv, nibo, semicolon-separator
