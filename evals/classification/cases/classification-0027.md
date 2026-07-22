---
case_id: "classification-0027"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0027 — Aluguel sem qualificador comercial/residencial

## Input (LedgerEntry)
- `description`: "PAGAMENTO ALUGUEL JOAO LOCADOR"
- `amountCents`: 180000
- `direction`: "debit"
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_administrativas"
expected_confidence_min: 0.45
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_despesas", "nao_classificado"]
```

## Justificativa
Aluguel sem indicação de finalidade (comercial vs residencial mascarado como empresarial) é ambíguo. Se for residencial do sócio pago pela PJ, vira `outras_despesas` (não-dedutível) ou pró-labore disfarçado. Modelo deve sinalizar revisão.

## Tags
real, ambiguous-aluguel
