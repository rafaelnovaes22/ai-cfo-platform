---
case_id: "cashflow-0017"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "edge"
priority: "P1"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0017 — Filtro category com valor inexistente nos lançamentos do período

## Input
- endpoint: GET /cashflow
- query: startDate=2026-02-01, endDate=2026-02-28, granularity=monthly, category=Investimentos
- tenant: PME com lançamentos em fevereiro classificados apenas nas categorias "Receita de Vendas", "Aluguel" e "Folha de Pagamento"; nenhum lançamento com category=="Investimentos"
- ledger_setup: 30 LedgerEntries em fev 2026 distribuídas nas 3 categorias mencionadas; totalCreditsCents real > 0; nenhuma entrada com confirmedCategory == "Investimentos"

## Expected assertions
- status: 200
- summary.totalCreditsCents: == 0
- summary.totalDebitsCents: == 0
- summary.creditCount: == 0
- summary.debitCount: == 0
- chart: == []
- table: == []
- latency_ms: < 400

## Justificativa
Um filtro por categoria válida mas inexistente no período não é um erro — é um resultado vazio legítimo. Retornar 404 ou 400 seria incorreto e quebraria a UX do painel de filtros. O frontend usa esse comportamento para renderizar o estado "nenhum lançamento para esta categoria no período" sem tratamento de erro adicional. Importante também confirmar que o filtro é aplicado corretamente e não retorna dados de outras categorias por acidente.
