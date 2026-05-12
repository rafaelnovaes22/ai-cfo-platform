---
case_id: "ingest-0023"
module: "ingest"
outcome: "ingest_failed"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0023 — CSV em encoding CP1252 (Latin1) lido como UTF-8

## Input
- `source`: csv
- `payload`: CSV de planilha legada BR em Windows-1252, conteúdo com acentos (ç, ã, é), enviado sem header de charset; chardet falha em detectar ou parser quebra na validação
- `tenantId`: "tenant-test-023"
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
§1.6 ex.3 + §9 risco #1: encoding mal detectado → todas as descrições corrompidas → shape inválido → 0 entries → failed.

## Tags
edge, csv, encoding-cp1252, latin1, charset-mismatch
