---
case_id: "classification-0018"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0018 — Devolução de venda (dedução)

## Input (LedgerEntry)
- `description`: "DEVOLUCAO VENDA NF 1122 CLIENTE GAMMA"
- `amountCents`: 95000
- `direction`: "debit"
- `date`: "2026-04-18"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "deducoes_receita"
expected_confidence_min: 0.80
acceptable_alternatives: []
```

## Justificativa
Devolução de venda é dedução da receita bruta (não despesa). Taxonomia agrega devoluções/descontos/ICMS/ISS/PIS/COFINS em `deducoes_receita`.

## Tags
synthetic, deducao, devolucao
