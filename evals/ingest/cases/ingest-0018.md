---
case_id: "ingest-0018"
module: "ingest"
outcome: "ingest_partial"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0018 — Mistura de locales (decimal `,` e `.`) gera órfãos

## Input
- `source`: csv
- `payload`: CSV com 70 linhas — 55 no formato BR `1.500,00`, 15 no formato US `1500.00`, parser detecta locale principal mas marca as 15 dissonantes como órfãs
- `tenantId`: "tenant-test-018"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 55,
  "orphanCount": 15,
  "outcome": "partial"
}
```

## Justificativa
55 ≥ 50 MAS orphanCount > 0 → R2 (§9 risco #7 — mistura de locales). Predicado disjuntivo aciona partial.

## Tags
edge, csv, mixed-locale, br-us-decimal
