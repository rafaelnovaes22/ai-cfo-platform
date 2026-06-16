---
case_id: "classification-0035"
module: "classification"
outcome: "ledger_classified"
source_mode: "edge"
priority: "P1"
created_at: "2026-06-10"
---

# Case classification-0035 — Pró-labore sem marcação de direção

## Input (LedgerEntry)
- `description`: "Pró-labore Cid Moreira"
- `amountCents`: 900000
- `direction`: "unknown"
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "prolabore"
expected_confidence_min: 0.80
acceptable_alternatives: []
```

## Justificativa
Derivado da planilha CID & CID (regressão PR #164). Pró-labore tem regra explícita no prompt (não é `despesas_pessoal`) e natureza débito inequívoca. Edge: direção "unknown" + nome de pessoa física na descrição não devem desviar para receita nem para folha CLT.

## Tags
edge, direction-unknown, prolabore, regressao-pr164
