---
case_id: "classification-0002"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0002 — INSS sobre folha de pagamento

## Input (LedgerEntry)
- `description`: "GPS INSS COMPETENCIA 04/2026"
- `amountCents`: 123400
- `direction`: "debit"
- `date`: "2026-05-15"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "despesas_pessoal"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
INSS patronal é encargo sobre folha CLT — classifica em `despesas_pessoal` conforme taxonomia (que agrupa salários CLT + encargos + benefícios). Guia GPS é evidência canônica.

## Tags
real, encargo-folha, inss
