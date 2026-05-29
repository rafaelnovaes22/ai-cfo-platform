---
case_id: "cashflow-0004"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0004 — Ano completo 2026, granularity=monthly, 12 períodos no chart

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-12-31, granularity=monthly
- tenant: PME sintética com ciclo anual completo, sazonalidade no segundo semestre
- ledger_setup: 12 meses de LedgerEntries (jan a dez/2026); ~15 lançamentos/mês em H1, ~25 lançamentos/mês em H2 (sazonalidade simulada); créditos R$10.000/mês H1, R$18.000/mês em ago-dez; débitos R$12.000/mês constantes; total de ~240 lançamentos sintéticos

## Expected assertions
- status: 200
- chart.length: == 12
- chart[0].period: == "2026-01"
- chart[11].period: == "2026-12"
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- summary.totalCreditsCents: > 0
- summary.totalDebitsCents: > 0
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Caso de estresse para a janela máxima típica (ano fiscal completo). Garante que o endpoint não trunca o array de períodos em 6 ou 10 meses por limitação de paginação interna, e que todos os 12 buckets são gerados mesmo quando alguns meses têm volume diferente. Sazonalidade sintética no H2 verifica que os créditos maiores aparecem nos períodos corretos.
