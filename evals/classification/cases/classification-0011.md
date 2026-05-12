---
case_id: "classification-0011"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0011 — Pagamento de parcela de empréstimo (principal)

## Input (LedgerEntry)
- `description`: "DEBITO PARCELA 12/36 EMPRESTIMO CONTRATO 778899"
- `amountCents`: 160000
- `direction`: "debit"
- `date`: "2026-04-15"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "amortizacao_dividas"
expected_confidence_min: 0.80
acceptable_alternatives: ["despesas_financeiras"]
```

## Justificativa
Parcela de empréstimo contém principal (`amortizacao_dividas`) e juros (`despesas_financeiras`). Como descrição não separa, classificar no principal é o esperado; juros do mês costuma vir em lançamento separado. Alternativa aceitável se o modelo agrupar como despesa financeira.

## Tags
real, amortizacao, emprestimo
