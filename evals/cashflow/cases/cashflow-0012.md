---
case_id: "cashflow-0012"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0012 — openingBalance preenchido, verificação aritmética closingBalance

## Input
- endpoint: GET /cashflow
- query: startDate=2026-02-01, endDate=2026-02-28, granularity=monthly
- tenant: PME com MonthlyAnalysis anterior (jan/2026) já fechada e openingBalanceCents registrado
- ledger_setup: MonthlyAnalysis de jan/2026 encerrada com closingBalanceCents=500000 (R$5.000,00); esse valor torna-se openingBalanceCents de fev/2026; LedgerEntries em fev/2026: 10 créditos somando R$8.000,00 (800000 centavos) + 5 débitos somando R$3.000,00 (300000 centavos); closingBalance esperado = 500000 + 800000 - 300000 = 1000000 (R$10.000,00)

## Expected assertions
- status: 200
- summary.openingBalanceCents: != null
- summary.openingBalanceCents: == 500000
- summary.closingBalanceCents: != null
- summary.closingBalanceCents: == 1000000
- summary.totalCreditsCents: == 800000
- summary.totalDebitsCents: == 300000
- summary.closingBalanceCents: == summary.openingBalanceCents + summary.totalCreditsCents - summary.totalDebitsCents
- chart.length: == 1
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Caso crítico para a integridade do saldo acumulado (opening/closing balance). O Aicfo não é apenas um relatório de período isolado — ele mantém continuidade do saldo entre meses. A verificação aritmética `closingBalance = opening + credits - debits` é a regra de ouro de qualquer sistema contábil. Falha aqui significa que o produto está reportando saldos incorretos aos clientes, risco grave de decisões financeiras erradas.
