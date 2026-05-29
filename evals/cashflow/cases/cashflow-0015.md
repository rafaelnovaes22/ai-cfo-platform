---
case_id: "cashflow-0015"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0015 — Lançamentos presentes mas openingBalanceCents null (sem MonthlyAnalysis)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-03-01, endDate=2026-03-31, granularity=monthly
- tenant: PME com lançamentos importados em março, porém nunca rodou o pipeline monthly-analysis; nenhum registro em `monthly_analyses` para este tenant
- ledger_setup: 28 LedgerEntries em março 2026 (15 créditos totalizando R$45.000, 13 débitos totalizando R$32.000); campo `confirmedCategory` preenchido em todas; nenhuma MonthlyAnalysis associada ao período

## Expected assertions
- status: 200
- summary.openingBalanceCents: == null
- summary.closingBalanceCents: == null
- summary.totalCreditsCents: > 0
- summary.totalDebitsCents: > 0
- summary.creditCount: == 15
- summary.debitCount: == 13
- chart.length: == 1
- chart[0].period: == "2026-03"
- table.length: >= 1
- latency_ms: < 600

## Justificativa
O saldo de abertura/fechamento depende de dados da MonthlyAnalysis (ADR-011), que pode não existir para tenants que importaram lançamentos mas nunca rodaram análise. O endpoint deve ser tolerante a esse estado parcial: exibe os lançamentos normalmente mas expõe `null` nos campos de saldo em vez de calcular incorretamente ou retornar erro. Garante que a UI pode renderizar a tela parcialmente (sem o widget de saldo) sem quebrar.
