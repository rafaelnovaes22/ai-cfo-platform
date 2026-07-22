---
case_id: "cashflow-0003"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0003 — Semestre jan-jun/2026, granularity=monthly, 6 períodos no chart

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-06-30, granularity=monthly
- tenant: PME sintética com padrão de receita crescente ao longo do semestre
- ledger_setup: 6 meses de LedgerEntries (jan a jun/2026); média de 20 lançamentos/mês; créditos crescem de R$8.000 em jan até R$13.000 em jun; débitos estáveis ~R$10.000/mês; total de ~120 lançamentos sintéticos

## Expected assertions
- status: 200
- chart.length: == 6
- chart[0].period: == "2026-01"
- chart[5].period: == "2026-06"
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- summary.totalCreditsCents: > 0
- summary.totalDebitsCents: > 0
- summary.creditCount: > 0
- summary.debitCount: > 0
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Valida que a agregação mensal cobre exatamente 6 períodos sem criar períodos fantasmas ou descartar o último mês. Cenário semestral é o período de análise mais comum para PMEs em revisão estratégica. Usa dados sintéticos para garantir reprodutibilidade do teste sem dependência de dados reais.
