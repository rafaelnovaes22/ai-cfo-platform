---
case_id: "cashflow-0001"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0001 — Trimestre completo, granularity=monthly, saldo negativo recorrente

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-03-31, granularity=monthly
- tenant: PME de varejo com histórico real de 3 meses, receita menor que despesa
- ledger_setup: 142 LedgerEntries distribuídas em jan/fev/mar 2026; créditos ~R$12.000/mês (3 entradas de R$4.000 cada); débitos ~R$20.000/mês (múltiplas saídas: aluguel, folha, fornecedores, impostos); saldo acumulado negativo ao final de março

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 3600000 (3 × R$12.000,00)
- summary.totalDebitsCents: == 6000000 (3 × R$20.000,00)
- summary.creditCount: == 9 (3 créditos × 3 meses)
- summary.debitCount: == 133 (142 − 9)
- chart.length: == 3
- chart[0].period: == "2026-01"
- chart[1].period: == "2026-02"
- chart[2].period: == "2026-03"
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- table.length: >= 3
- latency_ms: < 800

## Justificativa
Cenário P0 de maior relevância para o produto: PME com caixa negativo durante trimestre completo. Valida a agregação mensal básica, a cobertura dos 3 períodos esperados no chart, a integridade dos contadores de crédito/débito e a presença de pelo menos uma linha por categoria na tabela. É o caso mínimo que demonstra o fluxo de caixa "real" de um cliente típico do ICP.
