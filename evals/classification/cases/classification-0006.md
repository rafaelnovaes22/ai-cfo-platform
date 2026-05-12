---
case_id: "classification-0006"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0006 — SaaS / assinatura cloud

## Input (LedgerEntry)
- `description`: "AWS SERVICES ANNUAL SUBSCRIPTION"
- `amountCents`: 89000
- `direction`: "debit"
- `date`: "2026-04-12"
- `tenant_context`: { industrySegment: "tecnologia", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "despesas_ti"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
AWS é cloud — taxonomia tem categoria dedicada `despesas_ti` cobrindo SaaS/cloud/hardware/licenças. Descrição canônica não-ambígua.

## Tags
real, cloud, saas, ti
