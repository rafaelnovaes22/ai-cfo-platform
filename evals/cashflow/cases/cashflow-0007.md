---
case_id: "cashflow-0007"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "quarterly"
created_at: "2026-05-28"
---

# Case cashflow-0007 — Semestre jan-jun/2026 com granularity=quarterly, 2 quarters distintos

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-06-30, granularity=quarterly
- tenant: PME sintética com perfil de serviços (contratos mensais recorrentes)
- ledger_setup: 6 meses de LedgerEntries sintéticas distribuídas uniformemente; Q1: exatamente 3 créditos (um por mês, R$5.000 cada) + 9 débitos (três por mês, R$1.500 cada); Q2: mesma estrutura; total de 24 lançamentos

## Expected assertions
- status: 200
- chart.length: == 2
- chart[0].period: == "2026-Q1"
- chart[1].period: == "2026-Q2"
- chart[0].creditsCents: == 1500000 (3 × R$5.000,00)
- chart[0].debitsCents: == 405000 (9 × R$1.500 × 3 = R$4.050 → 405000 centavos)
- summary.creditCount: == 6 (3 créditos × 2 quarters)
- summary.debitCount: == 18 (9 débitos × 2 quarters)
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Complementa cashflow-0006 com estrutura mais regular (contratos recorrentes) para garantir que a lógica de agrupamento quarterly funciona de forma idêntica independentemente do padrão de distribuição dos lançamentos dentro de cada trimestre. Também valida que creditCount e debitCount no summary refletem o total de lançamentos, não o número de buckets.
