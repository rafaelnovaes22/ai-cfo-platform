---
case_id: "classification-0005"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0005 — Aluguel comercial

## Input (LedgerEntry)
- `description`: "ALUGUEL SALA COMERCIAL ED CENTRAL ABRIL"
- `amountCents`: 350000
- `direction`: "debit"
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_administrativas"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
Aluguel de sala comercial é despesa administrativa típica (taxonomia agrega aluguel/condomínio em `despesas_administrativas`). "Sala comercial" elimina dúvida sobre uso residencial.

## Tags
real, aluguel, despesa-admin
