---
case_id: "classification-0026"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0026 — TED genérico sem identificação

## Input (LedgerEntry)
- `description`: "TED 1200"
- `amountCents`: 120000
- `direction`: "debit"
- `date`: "2026-04-20"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "nao_classificado"
expected_confidence_min: 0.30
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_despesas", "transferencia_interna", "despesas_administrativas"]
```

## Justificativa
Descrição vazia de semântica ("TED 1200") é caso canônico de revisão humana. Modelo deve retornar baixa confidence e qualquer chute razoável serve, mas o ideal é cair em `nao_classificado` ou fronteira de despesa genérica.

## Tags
real, ambiguous-empty, ted-generico
