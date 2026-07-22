---
case_id: "classification-0007"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0007 — Tarifa bancária

## Input (LedgerEntry)
- `description`: "TARIFA MANUTENCAO CONTA PJ"
- `amountCents`: 5990
- `direction`: "debit"
- `date`: "2026-04-30"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_financeiras"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
Tarifa bancária é despesa financeira clássica — taxonomia agrupa juros/IOF/tarifas/maquininha em `despesas_financeiras`.

## Tags
real, tarifa, despesa-financeira
