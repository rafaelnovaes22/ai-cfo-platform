---
case_id: "classification-0004"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0004 — DAS Simples Nacional

## Input (LedgerEntry)
- `description`: "DARF DAS SIMPLES NACIONAL 04/2026"
- `amountCents`: 245000
- `direction`: "debit"
- `date`: "2026-05-20"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "simples_nacional"
expected_confidence_min: 0.95
acceptable_alternatives: []
```

## Justificativa
Guia DAS é o tributo unificado do Simples Nacional — categoria dedicada na taxonomia (`simples_nacional`). Descrição literal não admite ambiguidade.

## Tags
real, das, simples-nacional, tributo
