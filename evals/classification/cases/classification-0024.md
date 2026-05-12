---
case_id: "classification-0024"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0024 — TED a sócio (pró-labore vs distribuição de lucros)

## Input (LedgerEntry)
- `description`: "TED PARA JOAO SILVA SOCIO R$ 10.000"
- `amountCents`: 1000000
- `direction`: "debit"
- `date`: "2026-04-30"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "prolabore"
expected_confidence_min: 0.40
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_despesas"]
```

## Justificativa
TED para sócio sem rótulo (prolabore? distribuição de lucros? empréstimo ao sócio? reembolso?) é caso clássico de baixa confidence. Taxonomia atual não tem `distribuicao_lucros`, então alternativa cai em `outras_despesas`. Deve ir para revisão humana.

## Tags
real, ambiguous-prolabore, socio
