---
case_id: "classification-0017"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0017 — IRPJ trimestral

## Input (LedgerEntry)
- `description`: "DARF IRPJ TRIMESTRAL CODIGO 2089"
- `amountCents`: 380000
- `direction`: "debit"
- `date`: "2026-04-30"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "irpj_csll"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
DARF código 2089 é IRPJ pessoa jurídica trimestral. Taxonomia agrupa IRPJ + CSLL em `irpj_csll` (regimes não-Simples).

## Tags
synthetic, irpj, lucro-presumido
