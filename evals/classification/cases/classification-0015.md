---
case_id: "classification-0015"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0015 — Compra de matéria-prima (CMV)

## Input (LedgerEntry)
- `description`: "COMPRA MATERIA PRIMA FORNECEDOR ACME NF 4521"
- `amountCents`: 480000
- `direction`: "debit"
- `date`: "2026-04-08"
- `tenant_context`: { industrySegment: "industria", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "cpv_cmv"
expected_confidence_min: 0.85
acceptable_alternatives: []
```

## Justificativa
"Matéria-prima" para indústria é CMV/CPV por definição (`cpv_cmv` na taxonomia). Vincular ao contexto industrySegment fortalece a confidence.

## Tags
real, cmv, materia-prima, industria
