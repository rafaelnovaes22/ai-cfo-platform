---
case_id: "classification-0021"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0021 — Transferência entre contas próprias

## Input (LedgerEntry)
- `description`: "TRANSFERENCIA ENTRE CONTAS PROPRIAS BCO ITAU - BCO BB"
- `amountCents`: 1000000
- `direction`: "debit"
- `date`: "2026-04-10"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "transferencia_interna"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Transferência entre contas da própria empresa não impacta P&L — categoria dedicada (`transferencia_interna`). Regra crítica do prompt para não inflar custo nem receita.

## Tags
synthetic, transfer-internal
