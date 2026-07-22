---
case_id: "cashflow-0021"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0021 — GET /cashflow/summary sem ?date param (usa hoje por default)

## Input
- endpoint: GET /cashflow/summary
- query: (nenhum parâmetro)
- tenant: PME qualquer com lançamentos no histórico; pode ou não ter lançamentos na data corrente
- ledger_setup: tenant com ao menos 1 LedgerEntry em algum mês anterior; não é necessário lançamento para hoje especificamente

## Expected assertions
- status: 200
- date: == hoje no formato YYYY-MM-DD (valor dinâmico; o teste deve comparar com `new Date().toISOString().slice(0, 10)` no momento da execução)
- creditsCents: tipo number (>= 0)
- debitsCents: tipo number (>= 0)
- netCents: tipo number (== creditsCents − debitsCents)
- latency_ms: < 300

## Justificativa
Garante que o parâmetro `date` é opcional e que o default é a data atual do servidor, não uma data hardcoded ou `undefined`. Este comportamento é necessário para o carregamento inicial do dashboard (sem parâmetros na URL) funcionar corretamente. O valor de `date` no response deve ser a data de hoje para confirmar que o backend não está retornando dados de outro dia por acidente.
