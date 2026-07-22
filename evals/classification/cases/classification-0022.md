---
case_id: "classification-0022"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case classification-0022 — Multa de trânsito do veículo da empresa (outras despesas)

## Input (LedgerEntry)
- `description`: "MULTA DETRAN PLACA ABC1D23 VEICULO EMPRESA"
- `amountCents`: 19500
- `direction`: "debit"
- `date`: "2026-04-22"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "outras_despesas"
expected_confidence_min: 0.75
acceptable_alternatives: ["despesas_administrativas"]
```

## Justificativa
Multa não se enquadra em nenhuma das categorias específicas — taxonomia tem `outras_despesas` para esses casos. Modelo pode pensar em `despesas_administrativas`; alternativa aceitável.

## Tags
synthetic, outras-despesas, multa
