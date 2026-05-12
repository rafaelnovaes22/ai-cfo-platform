---
case_id: "classification-0003"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0003 — Pró-labore identificado por descrição

## Input (LedgerEntry)
- `description`: "TED PROLABORE SOCIO ABRIL 2026"
- `amountCents`: 1000000
- `direction`: "debit"
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "prolabore"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Descrição explicita "PROLABORE SOCIO" — categoria DRE dedicada (`prolabore`), distinta de salário CLT (`despesas_pessoal`). Caso canônico de alta confidence.

## Tags
real, prolabore, socio
