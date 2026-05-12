---
case_id: "ingest-0014"
module: "ingest"
outcome: "ingest_partial"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0014 — 80 entries válidas + 5 órfãs (acima do threshold mas com órfãos)

## Input
- `source`: excel
- `payload`: XLSX 85 linhas — 80 com shape válido, 5 com data inválida ou descrição em branco
- `tenantId`: "tenant-test-014"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 80,
  "orphanCount": 5,
  "outcome": "partial"
}
```

## Justificativa
80 ≥ 50 MAS orphanCount > 0 → R2 (predicado disjuntivo `< minEntries || orphanCount > 0`). Sinal de qualidade ruim mesmo com volume suficiente.

## Tags
edge, xlsx, orphans-above-threshold, quality-gate
