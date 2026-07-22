---
case_id: "classification-0028"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case classification-0028 — Reembolso de despesa (sentido ambíguo)

## Input (LedgerEntry)
- `description`: "REEMBOLSO DESPESA COLABORADOR ABRIL"
- `amountCents`: 42000
- `direction`: "debit"
- `date`: "2026-04-25"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "despesas_pessoal"
expected_confidence_min: 0.40
expected_confidence_max: 0.69
acceptable_alternatives: ["despesas_viagem", "despesas_administrativas", "outras_despesas"]
```

## Justificativa
Reembolso de despesa de colaborador sem detalhamento pode ser viagem (`despesas_viagem`), administrativa (combustível/estacionamento), ou benefício de pessoal. Modelo deve sinalizar baixa confidence.

## Tags
synthetic, ambiguous-reembolso
