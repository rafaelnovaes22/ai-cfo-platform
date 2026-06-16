---
case_id: "classification-0034"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-06-10"
---

# Case classification-0034 — Conta de energia sem marcação de direção

## Input (LedgerEntry)
- `description`: "Conta de energia - Light"
- `amountCents`: 134000
- `direction`: "unknown"
- `date`: "2026-04-10"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_administrativas"
expected_confidence_min: 0.70
acceptable_alternatives: ["outras_despesas"]
```

## Justificativa
Caso real da planilha CID & CID (regressão PR #164). Conta de energia da concessionária é despesa operacional pela semântica, mesmo sem sinal ou coluna Tipo. Aceita `outras_despesas` como alternativa (utilities oscilam entre administrativas e outras na taxonomia v1); o essencial é a natureza débito, nunca receita.

## Tags
real, direction-unknown, utilities, regressao-pr164
