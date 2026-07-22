---
case_id: "ingest-0007"
module: "ingest"
outcome: "ingest_completed"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0007 — CSV sintético com 200 linhas válidas

## Input
- `source`: csv
- `payload`: CSV gerado programaticamente, 200 linhas, separador `,`, header EN `date,memo,amount`, datas ISO `YYYY-MM-DD`, valores em float
- `tenantId`: "tenant-test-007"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 200,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
200 ≥ 50, headers EN detectados, direção derivada do sinal numérico (sem coluna `dir`) → R1.

## Tags
synthetic, csv, en-headers, derived-direction
