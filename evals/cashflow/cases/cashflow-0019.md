---
case_id: "cashflow-0019"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0019 — GET /cashflow/summary: dia com lançamentos (5 créditos + 3 débitos)

## Input
- endpoint: GET /cashflow/summary
- query: date=2026-05-20
- tenant: PME com operação regular; dia 2026-05-20 foi um dia útil normal
- ledger_setup: 8 LedgerEntries com `date == 2026-05-20`; 5 créditos totalizando R$18.500 (creditsCents=1850000); 3 débitos totalizando R$7.200 (debitsCents=720000); todas com confirmedCategory preenchida

## Expected assertions
- status: 200
- date: == "2026-05-20"
- creditsCents: == 1850000
- debitsCents: == 720000
- creditCount: == 5
- debitCount: == 3
- netCents: == 1130000 (creditsCents − debitsCents)
- latency_ms: < 300

## Justificativa
Caso P0 do endpoint de summary diário — alias simplificado de GET /cashflow para o widget de "hoje" no dashboard. Valida que o endpoint retorna os totais agregados corretos para um dia com movimentação mista (créditos e débitos), que o campo `date` é refletido no response, e que o cálculo de `netCents` é determinístico. É o cenário mais frequente de uso real deste endpoint pelo frontend do hub.
