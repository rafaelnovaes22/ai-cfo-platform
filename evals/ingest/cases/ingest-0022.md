---
case_id: "ingest-0022"
module: "ingest"
outcome: "ingest_failed"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0022 — XLSX corrompido (header truncado, ZIP inválido)

## Input
- `source`: excel
- `payload`: arquivo .xlsx com bytes truncados (download interrompido), biblioteca xlsx lança exceção ao abrir
- `tenantId`: "tenant-test-022"
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
Parser lança exceção → catch em service.ts retorna failed (§1.3 cláusula a). Nenhum LedgerEntry persistido.

## Tags
real, xlsx, corrupted, parse-exception
