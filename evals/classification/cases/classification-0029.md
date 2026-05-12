---
case_id: "classification-0029"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0029 — Estorno / valor negativo (sinal ambíguo)

## Input (LedgerEntry)
- `description`: "ESTORNO TARIFA INDEVIDA REF 03/2026"
- `amountCents`: 5990
- `direction`: "credit"
- `date`: "2026-04-03"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_financeiras"
expected_confidence_min: 0.50
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_receitas", "receita_financeira"]
```

## Justificativa
Edge case: estorno de tarifa é entrada (credit) mas conceitualmente reverte uma despesa financeira. Pode ser registrado como `despesas_financeiras` negativa ou `outras_receitas`. Modelo deve sinalizar incerteza pelo sinal cruzado direction=credit + semântica de despesa.

## Tags
edge, estorno, sinal-cruzado
