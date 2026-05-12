---
case_id: "classification-0010"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0010 — Entrada de empréstimo bancário

## Input (LedgerEntry)
- `description`: "CREDITO EMPRESTIMO CAPITAL GIRO CONTRATO 778899"
- `amountCents`: 5000000
- `direction`: "credit"
- `date`: "2026-04-02"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "emprestimos_entrada"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Empréstimo bancário NÃO é receita — é capital de terceiros. Taxonomia tem categoria dedicada `emprestimos_entrada` justamente para evitar inflar receita bruta. Regra crítica do prompt.

## Tags
real, emprestimo, capital-terceiros
