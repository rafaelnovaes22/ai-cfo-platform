---
case_id: "ingest-0003"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0003 — PDF extrato Itaú com 63 lançamentos

## Input
- `source`: pdf
- `payload`: PDF de extrato bancário Itaú PJ (texto selecionável, não escaneado), 63 transações no mês, formato `DD/MM HISTÓRICO VALOR D/C`, layout tabular padrão Itaú
- `tenantId`: "tenant-test-003"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 63,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
63 ≥ 50, PDF com camada de texto (pdf-parse extrai sem OCR), layout reconhecido → R1.

## Tags
real, pdf, itau, bank-statement
