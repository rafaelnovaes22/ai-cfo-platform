---
case_id: "ingest-0015"
module: "ingest"
outcome: "ingest_partial"
source_mode: "real"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0015 — Clipboard real: cliente cola 25 linhas do controle interno

## Input
- `source`: text
- `payload`: 25 linhas TSV coladas pelo cliente a partir de uma planilha de controle interno (Excel local), todas com shape válido, encoding UTF-8 — caso real de PME que ainda não tem ERP
- `tenantId`: "tenant-test-015"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 25,
  "orphanCount": 0,
  "outcome": "partial"
}
```

## Justificativa
25 < 50, sem órfãos → R2.

## Tags
real, clipboard, small-paste, pme-no-erp
