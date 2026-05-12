---
case_id: "ingest-0028"
module: "ingest"
outcome: "ingest_failed"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0028 — Upload de 20MB (DoS por tamanho)

## Input
- `source`: excel
- `payload`: XLSX de 20MB com milhões de células vazias (zip-bomb leve), Fastify multipart limit deve barrar OU parser explode na memória
- `tenantId`: "tenant-test-028"
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
Adversarial DoS por tamanho. Fastify rejeita ou parser lança → failed. §9 risco #8 (DoS por upload gigante).

## Tags
adversarial, xlsx, dos-size, 20mb, zip-bomb-light
