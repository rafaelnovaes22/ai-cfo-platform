---
case_id: "cashflow-0010"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "real"
priority: "P0"
granularity_tested: "daily"
created_at: "2026-05-28"
---

# Case cashflow-0010 — 1 dia único (startDate==endDate), granularity=daily

## Input
- endpoint: GET /cashflow
- query: startDate=2026-03-15, endDate=2026-03-15, granularity=daily
- tenant: PME de varejo com lançamentos reais em 2026-03-15
- ledger_setup: Exatamente 1 dia na janela (2026-03-15); 3 LedgerEntries nessa data: 1 crédito R$2.000,00 (venda à vista) + 1 débito R$800,00 (fornecedor) + 1 débito R$350,00 (serviço); LedgerEntries em outras datas existem no banco mas não devem aparecer no resultado

## Expected assertions
- status: 200
- chart.length: <= 1
- summary.totalCreditsCents: == 200000
- summary.totalDebitsCents: == 115000 (R$800,00 + R$350,00)
- summary.creditCount: == 1
- summary.debitCount: == 2
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Caso de edge para janela de 1 dia (startDate == endDate). Verifica que o filtro de data é inclusivo em ambas as extremidades e que lançamentos de outros dias no banco do tenant não vazam para o resultado. chart.length deve ser 0 (se não há lançamentos nesse dia — mas neste setup há lançamentos) ou 1 (se o endpoint inclui dias com dados). O assertion chart.length <= 1 cobre ambas as implementações válidas. Também garante que a soma dos débitos está correta com múltiplas entradas no mesmo dia.
