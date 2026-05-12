---
case_id: "ingest-0001"
module: "ingest"
outcome: "ingest_completed"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case ingest-0001 — Excel real do Conta Azul com 142 lançamentos

## Input
- `source`: excel
- `payload`: Planilha XLSX exportada do Conta Azul, 142 linhas, headers BR `Data | Histórico | Valor | Tipo`, encoding UTF-8, valores no padrão `R$ 1.234,56`, datas `DD/MM/YYYY`
- `tenantId`: "tenant-test-001"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 142,
  "orphanCount": 0,
  "outcome": "completed"
}
```

## Justificativa
142 ≥ 50 (default minEntries), shape válido em todas as linhas, sem órfãos → R1 (§1.1 spec). Persiste 142 LedgerEntry e enfileira classification.

## Tags
real, xlsx, conta-azul, locale-br
