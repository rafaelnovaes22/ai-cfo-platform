---
case_id: "cashflow-0013"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "synthetic"
priority: "P1"
granularity_tested: "weekly"
created_at: "2026-05-28"
---

# Case cashflow-0013 — 4 semanas de dados com granularity=weekly, formato "YYYY-Www"

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-05, endDate=2026-02-01, granularity=weekly
- tenant: PME sintética com atividade semanal regular em janeiro/2026
- ledger_setup: 4 semanas ISO de LedgerEntries sintéticas; W02 (2026-01-05 a 2026-01-11): 5 lançamentos (3 créditos R$1.000 + 2 débitos R$600); W03 (2026-01-12 a 2026-01-18): 4 lançamentos (2 créditos R$1.200 + 2 débitos R$500); W04 (2026-01-19 a 2026-01-25): 6 lançamentos (3 créditos R$900 + 3 débitos R$700); W05 (2026-01-26 a 2026-02-01): 3 lançamentos (2 créditos R$800 + 1 débito R$400); total de 18 lançamentos

## Expected assertions
- status: 200
- chart.length: <= 4
- chart[*].period matches regex: /^\d{4}-W\d{2}$/
- chart[0].period: == "2026-W02"
- chart[3].period: == "2026-W05"
- chart[*].creditsCents: >= 0
- chart[*].debitsCents: >= 0
- summary.totalCreditsCents: == 1090000 (R$1.000×3 + R$1.200×2 + R$900×3 + R$800×2 = R$10.900,00)
- summary.totalDebitsCents: == 430000 (R$600×2 + R$500×2 + R$700×3 + R$400×1 = R$4.300,00)
- summary.creditCount: == 10
- summary.debitCount: == 8
- table.length: >= 1
- latency_ms: < 800

## Justificativa
Valida a granularity=weekly que segue numeração ISO 8601 (semanas como "YYYY-Www"). O formato do campo period é crítico para integração com o frontend — qualquer variação (ex: "W2" sem zero à esquerda, ou "2026/W02") quebra o parsing do gráfico. Os valores sintéticos permitem verificação aritmética precisa do total acumulado nas 4 semanas. Caso especialmente relevante para PMEs que fazem ciclos de pagamento semanais.
