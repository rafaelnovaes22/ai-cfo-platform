---
case_id: "cashflow-0030"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0030 — Período futuro (próximo mês sem lançamentos ainda)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-07-01, endDate=2026-07-31, granularity=monthly
- tenant: PME com histórico até maio/junho 2026; nenhum lançamento importado para julho 2026 (futuro)
- ledger_setup: tenant com LedgerEntries somente até 2026-06-30; tabela `ledger_entries` não contém registros com `date >= 2026-07-01` para este tenantId

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 0
- summary.totalDebitsCents: == 0
- summary.creditCount: == 0
- summary.debitCount: == 0
- summary.openingBalanceCents: == null (não há MonthlyAnalysis para o futuro)
- summary.closingBalanceCents: == null
- chart: == []
- table: == []
- latency_ms: < 400

## Justificativa
Usuários podem navegar para meses futuros no seletor de período (para planejar ou verificar se há lançamentos provisionados). O backend não deve tratar datas futuras como inválidas — são um range legítimo sem dados. Comportamento esperado idêntico ao de um mês passado sem lançamentos (cashflow-0014). Importante garantir que a query SQL com `date >= futuro` não retorna lixo ou dados de outro tenant por bug de filtro.
