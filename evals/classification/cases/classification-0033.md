---
case_id: "classification-0033"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-06-10"
---

# Case classification-0033 — DAS sem marcação de direção (planilha sem coluna Tipo)

## Input (LedgerEntry)
- `description`: "DAS Simples Nacional"
- `amountCents`: 387000
- `direction`: "unknown"
- `date`: "2026-04-20"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "simples_nacional"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
Caso real da planilha CID & CID (regressão PR #164): arquivo sem coluna Tipo preenchida e valores todos positivos chega ao classificador com direction "unknown". Guia DAS é inequivocamente `simples_nacional` (despesa) pela semântica, independente da direção informada. Antes do PR #164, o viés direction="credit" fazia despesas serem classificadas como receita.

## Tags
real, direction-unknown, simples-nacional, regressao-pr164
