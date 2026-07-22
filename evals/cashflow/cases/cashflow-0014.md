---
case_id: "cashflow-0014"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0014 — Período sem nenhum lançamento (tenant sem dados importados)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-01-31, granularity=monthly
- tenant: PME recém-cadastrada que completou workspace-setup mas ainda não importou nenhum lançamento
- ledger_setup: tenant existe no banco (registro em `tenants`), mas tabela `ledger_entries` não contém nenhum registro para este tenantId; nenhuma MonthlyAnalysis cadastrada

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 0
- summary.totalDebitsCents: == 0
- summary.creditCount: == 0
- summary.debitCount: == 0
- summary.openingBalanceCents: == null (sem MonthlyAnalysis)
- summary.closingBalanceCents: == null
- chart: == []
- table: == []
- latency_ms: < 400

## Justificativa
Caso obrigatório P0 para garantir que o endpoint não retorna 404, 500 ou dados fantasma quando o tenant existe mas não importou dados. Um novo cliente que abre o dashboard logo após o cadastro deve ver tela vazia sem erro — qualquer status diferente de 200 ou presença de dados de outro tenant seria regressão crítica de onboarding e de isolamento de dados.
