---
case_id: "ingest-0025"
module: "ingest"
outcome: "ingest_failed"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0025 — CSV real exportado vazio (contadora exportou mês sem movimento)

## Input
- `source`: csv
- `payload`: CSV exportado de ERP da contadora — só contém linha de header `Data;Descrição;Valor;Tipo` (mês sem lançamentos). Caso real de empresa em hiato
- `tenantId`: "tenant-test-025"
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
parseText retorna entries=[] orphanCount=0 (test spec parsers-text "only header line"). R3 (§1.3 cláusula b).

## Tags
real, csv, header-only, zero-entries, empty-month-export
