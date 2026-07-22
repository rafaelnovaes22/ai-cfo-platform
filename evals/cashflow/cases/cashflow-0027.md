---
case_id: "cashflow-0027"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0027 — 1.000 lançamentos em 1 mês, granularity=monthly

## Input
- endpoint: GET /cashflow
- query: startDate=2026-05-01, endDate=2026-05-31, granularity=monthly
- tenant: PME de alto volume (distribuidora ou e-commerce) com 1.000 LedgerEntries em maio 2026
- ledger_setup: 1.000 LedgerEntries com `date` distribuído em mai 2026; 400 créditos (totalCreditsCents=50000000, R$500k) + 600 débitos (totalDebitsCents=38000000, R$380k); 10 categorias distintas; todas com confirmedCategory preenchida

## Expected assertions
- status: 200
- summary.creditCount + summary.debitCount: == 1000
- summary.totalCreditsCents: == 50000000
- summary.totalDebitsCents: == 38000000
- chart.length: == 1
- chart[0].period: == "2026-05"
- table.length: == 10
- latency_ms: < 800
- response não contém truncagem (todos 1.000 lançamentos computados no summary)

## Justificativa
PMEs de médio porte com sistemas ERP podem gerar centenas de lançamentos mensais. O endpoint deve ser performático o suficiente para responder em menos de 800ms mesmo com 1.000 registros, o que exige query SQL eficiente com índice em (tenantId, date). O caso verifica que não há paginação silenciosa no summary que causaria subtotal incorreto, e que a agregação por categoria na `table` comporta 10 linhas sem truncar.
