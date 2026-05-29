---
case_id: "cashflow-0020"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P1"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0020 — GET /cashflow/summary: dia sem lançamentos (data futura ou não trabalhado)

## Input
- endpoint: GET /cashflow/summary
- query: date=2026-06-07
- tenant: PME com histórico até maio 2026; nenhum lançamento importado para junho (data futura)
- ledger_setup: tenant possui LedgerEntries somente até 2026-05-31; tabela `ledger_entries` não contém nenhum registro com `date >= 2026-06-01` para este tenantId

## Expected assertions
- status: 200
- date: == "2026-06-07"
- creditsCents: == 0
- debitsCents: == 0
- creditCount: == 0
- debitCount: == 0
- netCents: == 0
- latency_ms: < 300

## Justificativa
O widget de "hoje" no dashboard é chamado para qualquer data, inclusive futuras (quando o usuário navega o calendário) ou dias não trabalhados. O endpoint deve retornar 200 com zeros em vez de 404 ou erro, mantendo a consistência de contrato com o frontend. Também valida que a ausência de lançamentos não gera NaN ou undefined nos campos numéricos do response.
