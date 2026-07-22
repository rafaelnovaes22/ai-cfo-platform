---
case_id: "cashflow-0028"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P1"
granularity_tested: "daily"
created_at: "2026-05-28"
---

# Case cashflow-0028 — Período de 365 dias, granularity=daily (máximo)

## Input
- endpoint: GET /cashflow
- query: startDate=2025-06-01, endDate=2026-05-31, granularity=daily
- tenant: PME com operação contínua nos últimos 12 meses; lançamentos em dias úteis (~250 dias com movimento)
- ledger_setup: ~2.500 LedgerEntries distribuídas ao longo de 365 dias (média 10/dia em dias úteis); totalCreditsCents e totalDebitsCents definidos; dias sem lançamento (fins de semana, feriados) não aparecem no chart ou aparecem com valor 0 dependendo da implementação

## Expected assertions
- status: 200
- chart.length: <= 366 (máximo de pontos diários em 365 dias; pode ser até 366 em ano bissexto)
- chart.length: >= 1
- chart[*].period: todos no formato "YYYY-MM-DD"
- summary.creditCount + summary.debitCount: == total de lançamentos no período
- latency_ms: < 800

## Justificativa
Granularity=daily com 365 dias é o cenário de maior volume de pontos no array `chart`. Valida que: (a) o backend não ultrapassa 366 pontos (limite de dias possíveis); (b) o formato de `period` muda de "YYYY-MM" (monthly) para "YYYY-MM-DD" (daily) corretamente; (c) a performance ainda é aceitável (<800ms) mesmo com SQL de 365 agrupamentos; (d) não há off-by-one gerando 367+ pontos.
