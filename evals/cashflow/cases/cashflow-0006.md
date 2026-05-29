---
case_id: "cashflow-0006"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "quarterly"
created_at: "2026-05-28"
---

# Case cashflow-0006 — Dois trimestres jan-jun/2026, granularity=quarterly, 2 quarters no chart

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-06-30, granularity=quarterly
- tenant: PME sintética com H1 completo
- ledger_setup: 6 meses de LedgerEntries sintéticas; Q1 (jan-mar): 30 lançamentos, créditos R$15.000 total, débitos R$20.000 total; Q2 (abr-jun): 35 lançamentos, créditos R$18.000 total, débitos R$16.000 total; total de 65 lançamentos

## Expected assertions
- status: 200
- chart.length: == 2
- chart[0].period: == "2026-Q1"
- chart[1].period: == "2026-Q2"
- chart[0].creditsCents: == 1500000
- chart[0].debitsCents: == 2000000
- chart[1].creditsCents: == 1800000
- chart[1].debitsCents: == 1600000
- summary.totalCreditsCents: == 3300000
- summary.totalDebitsCents: == 3600000
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Valida que dois trimestres consecutivos produzem exatamente 2 buckets e que os valores de crédito/débito de cada quarter são somados corretamente sem vazamento entre períodos. Os valores sintéticos são fixos e permitem verificação aritmética precisa, detectando bugs de fronteira de data (ex: 2026-04-01 sendo incluído no Q1 por erro de fuso horário).
