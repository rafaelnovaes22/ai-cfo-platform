---
case_id: "ingest-0026"
module: "ingest"
outcome: "ingest_failed"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0026 — Upload de arquivo binário não-tabular (.exe renomeado para .xlsx)

## Input
- `source`: excel
- `payload`: binário arbitrário (executável) com extensão renomeada para .xlsx — biblioteca xlsx lança exceção ao tentar parsear
- `tenantId`: "tenant-test-026"
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
Adversarial: cliente envia arquivo malformado. Parser lança → R3 cláusula a. Sem persistência. Indicador de tentativa de bypass.

## Tags
adversarial, fake-extension, binary-not-xlsx, parser-throws
