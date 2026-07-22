---
case_id: "ingest-0030"
module: "ingest"
outcome: "ingest_failed"
source_mode: "adversarial"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0030 — Filename injection: `../../etc/passwd.csv`

## Input
- `source`: csv
- `payload`: upload multipart com filename `"../../../etc/passwd.csv"` e conteúdo CSV não-parseável (binário + path traversal). Backend sanitiza filename e parser falha no conteúdo
- `tenantId`: "tenant-test-030"
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
Adversarial security: filename path traversal não causa escrita arbitrária (backend ignora filename), e conteúdo inválido → failed. Garante que o ingest é resiliente a filename injection.

## Tags
adversarial, security, path-traversal, filename-injection
