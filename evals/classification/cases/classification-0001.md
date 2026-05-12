---
case_id: "classification-0001"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0001 — Pix recebido de cliente (receita de serviços)

## Input (LedgerEntry)
- `description`: "PIX RECEBIDO JOAO SILVA REF NF 1234"
- `amountCents`: 500000
- `direction`: "credit"
- `date`: "2026-04-10"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "receita_bruta"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
Pix recebido de pessoa física com referência a Nota Fiscal indica faturamento de serviço/produto principal. Em Simples Nacional, faturamento entra como `receita_bruta`. NF é evidência forte (alta confidence).

## Tags
real, receita-pix, simples-nacional
