---
case_id: "cashflow-0008"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "daily"
created_at: "2026-05-28"
---

# Case cashflow-0008 — Semana única com granularity=daily, apenas dias com lançamentos no chart

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-05, endDate=2026-01-11, granularity=daily
- tenant: PME de serviços com lançamentos reais apenas em dias úteis da primeira semana de janeiro
- ledger_setup: 7 dias de janela (segunda a domingo 2026-01-05 a 2026-01-11); lançamentos apenas em dias úteis: 2026-01-05 (2 créditos R$500 cada), 2026-01-06 (1 débito R$300), 2026-01-07 (1 crédito R$700 + 1 débito R$200), 2026-01-08 (1 débito R$450), 2026-01-09 (2 créditos R$600 cada); nenhum lançamento em 2026-01-10 e 2026-01-11 (fim de semana)

## Expected assertions
- status: 200
- chart.length: >= 1
- chart.length: <= 7
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- summary.totalCreditsCents: == 290000 (R$500+R$500+R$700+R$600+R$600 = R$2.900,00)
- summary.totalDebitsCents: == 95000 (R$300+R$200+R$450 = R$950,00)
- summary.creditCount: == 6
- summary.debitCount: == 3
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Caso P0 para granularity=daily que verifica duas propriedades críticas: (1) chart.length reflete apenas dias com lançamentos (não todos os 7 dias da janela), e (2) dias sem movimento não geram buckets vazios no chart. Comportamento incorreto aqui quebraria a UX ao exibir barras zeradas em todos os fins de semana do mês.
