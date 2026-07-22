---
case_id: "ingest-0027"
module: "ingest"
outcome: "ingest_failed"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0027 — DoS por payload manual gigante (50_001 entries)

## Input
- `source`: manual
- `payload`: POST /ingest/manual com 50_001 entries (1 acima do limite MAX_ENTRIES_PER_INGEST)
- `tenantId`: "tenant-test-027"
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
§9 risco #8: Zod do payload manual rejeita >50_000 → erro 4xx OR service captura como failed. Caso assertion_shape valida o estado final esperado (failed + null).

## Tags
adversarial, manual, dos-large-payload, max-entries-exceeded
