---
case_id: "classification-0020"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case classification-0020 — Depreciação mensal

## Input (LedgerEntry)
- `description`: "DEPRECIACAO MENSAL EQUIPAMENTOS COMPETENCIA 04/2026"
- `amountCents`: 25000
- `direction`: "debit"
- `date`: "2026-04-30"
- `tenant_context`: { industrySegment: "industria", taxRegime: "lucro_real" }

## Ground truth
```yaml
expected_category: "depreciacao"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Lançamento contábil de depreciação tem categoria dedicada (`depreciacao`). Não é caixa — é ajuste de competência. Descrição literal.

## Tags
synthetic, depreciacao, lucro-real
