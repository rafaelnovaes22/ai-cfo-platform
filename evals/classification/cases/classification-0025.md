---
case_id: "classification-0025"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0025 — Compra em Casa & Vídeo (uso pessoal vs escritório)

## Input (LedgerEntry)
- `description`: "COMPRA CASA E VIDEO LOJA 234"
- `amountCents`: 78000
- `direction`: "debit"
- `date`: "2026-04-12"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_administrativas"
expected_confidence_min: 0.40
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_despesas", "capex", "nao_classificado"]
```

## Justificativa
Casa & Vídeo vende eletrodoméstico, eletrônico, móvel — pode ser material de escritório (`despesas_administrativas`), CAPEX (geladeira da copa) ou uso pessoal (não-dedutível). Sem detalhe da nota, modelo deve sinalizar baixa confidence.

## Tags
real, ambiguous-personal, varejo
