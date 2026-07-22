---
case_id: "classification-0012"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0012 — Ads Google / marketing

## Input (LedgerEntry)
- `description`: "GOOGLE ADS CAMPANHA ABRIL"
- `amountCents`: 85000
- `direction`: "debit"
- `date`: "2026-04-20"
- `tenant_context`: { industrySegment: "comercio", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_comerciais"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Google Ads é mídia paga / publicidade — taxonomia agrega marketing/ads/comissões em `despesas_comerciais`. Caso canônico.

## Tags
real, ads, marketing, despesa-comercial
