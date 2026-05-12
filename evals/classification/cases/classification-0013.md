---
case_id: "classification-0013"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0013 — Honorário contábil

## Input (LedgerEntry)
- `description`: "HONORARIOS CONTABEIS CONTABILIDADE XYZ ABRIL"
- `amountCents`: 75000
- `direction`: "debit"
- `date`: "2026-04-10"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_juridicas"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
Honorários de contador entram em `despesas_juridicas` (taxonomia agrupa honorários jurídicos + contábeis + consultoria).

## Tags
real, contabilidade, despesa-juridica
