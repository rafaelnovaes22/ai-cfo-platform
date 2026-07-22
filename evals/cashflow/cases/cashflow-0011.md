---
case_id: "cashflow-0011"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0011 — Filtro por category="Receita Bruta", apenas créditos no resultado

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-03-31, granularity=monthly, category=Receita Bruta
- tenant: PME de serviços com lançamentos em múltiplas categorias no Q1/2026
- ledger_setup: 60 LedgerEntries no Q1/2026; 15 lançamentos categorizados como "Receita Bruta" (todos créditos, R$3.000 cada); 25 como "Fornecedores" (todos débitos); 10 como "Folha de Pagamento" (todos débitos); 10 como "Impostos" (todos débitos); o filtro category="Receita Bruta" deve excluir as 45 entradas de outras categorias

## Expected assertions
- status: 200
- summary.totalDebitsCents: == 0
- summary.totalCreditsCents: > 0
- summary.creditCount: == 15
- summary.debitCount: == 0
- table.length: == 1
- table[0].category: == "Receita Bruta"
- chart.length: == 3
- chart[*].debitsCents: == 0
- latency_ms: < 800

## Justificativa
Valida o filtro por categoria, que é o segundo parâmetro mais usado pelos CEOs/CFOs após o período. Quando filtrado para uma categoria exclusivamente de créditos, totalDebitsCents deve ser exatamente 0 e table.length deve ser 1. Regressão crítica: se o filtro não funcionar, a tabela mostraria todas as 4 categorias e os débitos seriam não-zero, confundindo o usuário com dados irrelevantes.
