---
case_id: "ingest-0029"
module: "ingest"
outcome: "ingest_failed"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0029 — PDF criptografado (password-protected)

## Input
- `source`: pdf
- `payload`: PDF do contador com senha definida (criptografia AES); pdf-parse lança erro de acesso
- `tenantId`: "tenant-test-029"
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
Parser lança exceção → R3 cláusula a. Caso real comum (contador envia PDF protegido).

## Tags
real, pdf, password-protected, encrypted
