---
case_id: "ingest-0021"
module: "ingest"
outcome: "ingest_failed"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0021 — PDF escaneado (imagem) sem camada de texto

## Input
- `source`: pdf
- `payload`: PDF de extrato bancário escaneado a 300dpi — só contém imagens, sem layer de texto extraível
- `tenantId`: "tenant-test-021"
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
pdf-parse retorna texto vazio → entries.length === 0 → R3 (§1.3 / §1.6 ex.2 / §9 risco #2). Sem OCR no MVP.

## Tags
real, pdf, scanned-image, no-text-layer, ocr-needed
