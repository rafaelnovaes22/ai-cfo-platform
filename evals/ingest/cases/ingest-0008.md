---
case_id: "ingest-0008"
module: "ingest"
outcome: "ingest_completed"
source_mode: "adversarial"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0008 — Excel com 75 lançamentos, valores com parenteses contábeis

## Input
- `source`: excel
- `payload`: XLSX 75 linhas, valores negativos representados como `(1.234,56)` (notação contábil), direção inferida do sinal
- `tenantId`: "tenant-test-008"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 75,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
75 ≥ 50; normalizeAmountCents trata parenteses → amount positivo + direction=debit. R4 garante amountCents sempre positivo. Classificado como adversarial porque a notação contábil com parenteses é vetor comum de bug em parsers de valor (sinal embutido em string).

## Tags
adversarial, xlsx, accounting-parens, sign-from-parens, parser-edge
