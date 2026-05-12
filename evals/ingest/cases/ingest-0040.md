---
case_id: "ingest-0040"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0040 — Uploads concorrentes para mesmo par — apenas uma análise é criada

## Input
- `source`: excel
- `payload`: dois POST /ingest/upload disparados em paralelo (~50ms apart) para o mesmo (tenant, 2026-04), nenhum prévio. Cenário de race condition
- `tenantId`: "tenant-test-040"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty-single>",
  "entryCount": 80,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "exatamente 1 MonthlyAnalysis no DB para (tenant, 2026-04) — última request reaproveita ou ganha via último-write-wins; erro P2002 tratado"
}
```

## Justificativa
§9 risco #3: índice único composto + tratamento de P2002. new_analysis_triggered acontece UMA vez; segunda request cai no fluxo de re-import (update + deleteMany). Garante ausência de duplicatas.

## Tags
adversarial, race-condition, concurrent-upload, p2002-handling, unique-index
