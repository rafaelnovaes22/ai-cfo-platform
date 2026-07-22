---
case_id: "ingest-0020"
module: "ingest"
outcome: "ingest_partial"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0020 — CSV com 90% linhas inválidas (10 válidas em 100)

## Input
- `source`: csv
- `payload`: CSV com 100 linhas — apenas 10 com shape válido, 90 com datas/valores corrompidos. Adversarial: cliente colando lixo
- `tenantId`: "tenant-test-020"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 10,
  "orphanCount": 90,
  "outcome": "partial"
}
```

## Justificativa
entries > 0 → R2 (não cai em failed). Spec §10 declara este bucket adversarial. Sinal forte de problema de qualidade no upload.

## Tags
adversarial, csv, garbage-rows, high-orphan-rate
