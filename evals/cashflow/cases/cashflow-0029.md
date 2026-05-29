---
case_id: "cashflow-0029"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0029 — Período de 365 dias, granularity=monthly

## Input
- endpoint: GET /cashflow
- query: startDate=2025-06-01, endDate=2026-05-31, granularity=monthly
- tenant: PME com operação contínua nos últimos 12 meses (mesmo tenant do caso 0028)
- ledger_setup: ~2.500 LedgerEntries distribuídas ao longo de 12 meses (jun/2025 a mai/2026); todos os meses com ao menos 1 lançamento

## Expected assertions
- status: 200
- chart.length: == 12
- chart[0].period: == "2025-06"
- chart[11].period: == "2026-05"
- chart[*].period: todos no formato "YYYY-MM"
- summary.creditCount + summary.debitCount: == total de lançamentos nos 12 meses
- latency_ms: < 400

## Justificativa
Mesmo período de 365 dias, mas com granularity=monthly resulta em apenas 12 pontos no chart — a query de agregação é muito mais leve que o caso 0028. Valida que: (a) o backend usa a granularidade para determinar o formato do período no chart; (b) são exatamente 12 buckets mensais, sem duplicatas nem meses faltantes; (c) a latência é menor que no caso daily (meta <400ms vs <800ms) confirmando que a granularidade afeta a complexidade da query.
