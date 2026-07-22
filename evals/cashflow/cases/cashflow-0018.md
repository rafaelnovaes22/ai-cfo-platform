---
case_id: "cashflow-0018"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P1"
granularity_tested: "daily"
created_at: "2026-05-28"
---

# Case cashflow-0018 — startDate == endDate (período de 1 único dia sem lançamentos)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-05-04, endDate=2026-05-04, granularity=daily
- tenant: PME com lançamentos em maio 2026, mas nenhum lançamento no dia 2026-05-04 especificamente (domingo ou feriado)
- ledger_setup: tenant tem LedgerEntries nos dias 2026-05-02, 2026-05-05, 2026-05-06, mas nenhuma entry com `date == 2026-05-04`

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 0
- summary.totalDebitsCents: == 0
- summary.creditCount: == 0
- summary.debitCount: == 0
- summary.openingBalanceCents: == null (ou o saldo de abertura do dia, se calculável)
- chart: == []
- table: == []
- latency_ms: < 400

## Justificativa
Período de um único dia é o menor intervalo possível e um domingo/feriado sem lançamentos é comum para PMEs. Garante que: (a) o backend aceita startDate == endDate sem rejeitar como range inválido; (b) granularity=daily com 1 dia não gera erro de divisão ou array malformado; (c) a resposta é consistente com o comportamento de "período sem lançamentos" dos outros casos edge (0014, 0017).
