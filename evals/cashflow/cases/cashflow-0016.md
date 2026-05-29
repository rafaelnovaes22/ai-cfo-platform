---
case_id: "cashflow-0016"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0016 — Lançamentos com confirmedCategory null (importados mas não classificados)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-04-01, endDate=2026-04-30, granularity=monthly
- tenant: PME que importou planilha recente via ingest mas o pipeline de classification ainda não concluiu (ou foi rejeitado); lançamentos existem mas `confirmedCategory` é null
- ledger_setup: 20 LedgerEntries em abril 2026; 8 créditos (R$16.000 total) + 12 débitos (R$24.000 total); campo `confirmedCategory` == null em todos os registros; campo `suggestedCategory` pode estar preenchido ou não

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 1600000
- summary.totalDebitsCents: == 2400000
- summary.creditCount: == 8
- summary.debitCount: == 12
- chart.length: == 1
- table: contém ao menos uma entrada com category == "Sem categoria" (ou equivalente configurado no sistema)
- table[sem_categoria].totalCents: == totalCreditsCents + totalDebitsCents (todos os lançamentos agrupados nessa linha)
- latency_ms: < 600

## Justificativa
Entre a importação e a classificação existe uma janela de tempo em que o campo `confirmedCategory` é null. O endpoint não deve ignorar esses lançamentos (causaria discrepância nos totais) nem travar com null pointer. Agrupá-los sob "Sem categoria" preserva a integridade do summary e comunica ao usuário que há lançamentos pendentes de classificação — comportamento esperado pelo produto para a fase de onboarding.
