---
case_id: "classification-0019"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0019 — Aluguel recebido (outras receitas)

## Input (LedgerEntry)
- `description`: "RECEBIMENTO ALUGUEL SUBLOCACAO SALA"
- `amountCents`: 80000
- `direction`: "credit"
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "outras_receitas"
expected_confidence_min: 0.80
acceptable_alternatives: []
```

## Justificativa
Aluguel recebido por sublocação não é receita principal da PME (não é o core). Taxonomia tem `outras_receitas` justamente para aluguel/recuperação de despesas.

## Tags
synthetic, outras-receitas, aluguel-recebido
