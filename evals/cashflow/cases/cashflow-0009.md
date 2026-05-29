---
case_id: "cashflow-0009"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "daily"
created_at: "2026-05-28"
---

# Case cashflow-0009 — 30 dias com granularity=daily, chart.length <= 30

## Input
- endpoint: GET /cashflow
- query: startDate=2026-02-01, endDate=2026-03-02, granularity=daily
- tenant: PME sintética com atividade em dias úteis de fevereiro e início de março
- ledger_setup: 30 dias de janela; lançamentos sintéticos em 20 dos 30 dias (apenas dias úteis); 1-3 lançamentos por dia ativo; total de ~40 lançamentos; fevereiro tem 28 dias em 2026; nenhum lançamento nos 10 dias sem atividade (fins de semana e feriados)

## Expected assertions
- status: 200
- chart.length: >= 1
- chart.length: <= 30
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- summary.totalCreditsCents: > 0
- summary.totalDebitsCents: > 0
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Valida que a granularity=daily escala corretamente para 30 dias sem degradação de performance (latência < 800ms mesmo com até 30 buckets). Também confirma que a lógica de "apenas dias com lançamentos aparecem no chart" se mantém em janelas mensais, não apenas semanais. A janela de 30 dias cruzando a fronteira fev/mar testa se datas de fim de mês são tratadas corretamente.
