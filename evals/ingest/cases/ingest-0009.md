---
case_id: "ingest-0009"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0009 — PDF Bradesco PJ com 58 transações

## Input
- `source`: pdf
- `payload`: PDF de extrato Bradesco PJ, layout multi-página, 58 transações com camada de texto, datas DD/MM
- `tenantId`: "tenant-test-009"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 58,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
58 ≥ 50, PDF texto-selecionável de banco real → R1; valida heurística multi-página do parser PDF.

## Tags
real, pdf, bradesco, multi-page
