---
case_id: "cashflow-0005"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "quarterly"
created_at: "2026-05-28"
---

# Case cashflow-0005 — Trimestre jan-mar/2026, granularity=quarterly, 1 quarter no chart

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-03-31, granularity=quarterly
- tenant: PME de varejo com histórico real do Q1/2026
- ledger_setup: LedgerEntries cobrindo jan/fev/mar 2026; pelo menos 2 categorias distintas de lançamento (ex: "Receita Bruta" e "Fornecedores"); total de ~40 lançamentos reais; alguns créditos e vários débitos em cada mês do trimestre

## Expected assertions
- status: 200
- chart.length: == 1
- chart[0].period: == "2026-Q1"
- chart[0].creditsCents: > 0
- chart[0].debitsCents: > 0
- summary.totalCreditsCents: > 0
- summary.totalDebitsCents: > 0
- table.length: >= 2
- latency_ms: < 800

## Justificativa
Primeiro caso da granularity=quarterly. Verifica que 3 meses de dados colapsam em um único bucket "2026-Q1" e que o formato do período segue o padrão "YYYY-Qn". A exigência de table.length>=2 confirma que pelo menos 2 categorias distintas aparecem na tabela analítica mesmo com apenas 1 período no chart.
