---
case_id: "classification-0023"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0023 — Pix genérico sem contexto (receita ambígua)

## Input (LedgerEntry)
- `description`: "PIX RECEBIDO MARIA"
- `amountCents`: 50000
- `direction`: "credit"
- `date`: "2026-04-15"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "receita_bruta"
expected_confidence_min: 0.40
expected_confidence_max: 0.69
acceptable_alternatives: ["outras_receitas", "transferencia_interna", "nao_classificado"]
```

## Justificativa
Pix de pessoa física sem referência (NF, contrato, descrição do serviço) é ambíguo: pode ser cliente, sócia transferindo, devolução, empréstimo pessoal. Modelo deve retornar confidence <0.7 → `needs_review`. Categoria predita aceita qualquer das alternativas.

## Tags
real, ambiguous-pix, confidence-low
