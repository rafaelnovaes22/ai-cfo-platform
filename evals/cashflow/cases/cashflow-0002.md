---
case_id: "cashflow-0002"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0002 — Mês único, granularity=monthly, 50 lançamentos em fev/2026

## Input
- endpoint: GET /cashflow
- query: startDate=2026-02-01, endDate=2026-02-28, granularity=monthly
- tenant: PME de serviços com 50 lançamentos concentrados em fevereiro
- ledger_setup: 50 LedgerEntries em fev/2026; 20 créditos (receitas de clientes, ~R$1.500 cada); 30 débitos (despesas operacionais variadas, ~R$800 cada); nenhum lançamento fora do intervalo

## Expected assertions
- status: 200
- summary.creditCount: == 20
- summary.debitCount: == 30
- summary.creditCount + summary.debitCount: == 50
- summary.totalCreditsCents: == 3000000 (20 × R$1.500,00)
- summary.totalDebitsCents: == 2400000 (30 × R$800,00)
- chart.length: == 1
- chart[0].period: == "2026-02"
- chart[0].creditsCents: == 3000000
- chart[0].debitsCents: == 2400000
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Caso de janela mínima (1 mês) com granularity=monthly. Verifica que chart.length seja exatamente 1 — não zero, não mais de um — e que a soma de creditCount + debitCount reproduza exatamente o volume de lançamentos do setup. É o contrato mais simples possível do endpoint e deve ser o primeiro a falhar se a lógica de agrupamento mensal estiver errada.
