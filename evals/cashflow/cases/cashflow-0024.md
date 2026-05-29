---
case_id: "cashflow-0024"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0024 — Cross-tenant attempt: JWT do tenant A com ?tenantId=B na query

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-01-31, granularity=monthly, tenantId=tenant-B-uuid
- tenant: JWT pertence ao tenant A (tenantId extraído do claim `sub` ou `tenantId` do token); o parâmetro de query aponta para tenant B
- ledger_setup: tenant A tem 20 LedgerEntries em jan 2026 (totalCreditsCents=500000); tenant B tem 50 LedgerEntries no mesmo período (totalCreditsCents=2000000); os dados dos dois tenants são distintos

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 500000 (dados do tenant A, não do B)
- summary.creditCount: == 20 (contagem do tenant A)
- (ausência de dados do tenant B na resposta)
- query param `tenantId` é completamente ignorado — o tenantId vem sempre do JWT
- latency_ms: < 800

## Justificativa
Isolamento de dados entre tenants (C8 — anti-customização heroica, mas sobretudo requisito de segurança multi-tenant) é um gate P0 absoluto. O tenantId jamais deve ser aceito como parâmetro de query controlável pelo cliente — deve vir exclusivamente do JWT validado. Qualquer vazamento de dados cross-tenant inviabilizaria o produto comercialmente e violaria a LGPD. O teste confirma que o backend usa o tenantId do claim JWT e descarta silenciosamente o parâmetro de query.
