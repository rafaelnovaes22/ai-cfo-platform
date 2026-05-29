---
case_id: "cashflow-0032"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P1"
granularity_tested: "quarterly"
created_at: "2026-05-28"
---

# Case cashflow-0032 — 15 categorias distintas, granularity=quarterly

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-03-31, granularity=quarterly
- tenant: PME de serviços com plano de contas detalhado; 15 categorias distintas usadas no Q1 2026
- ledger_setup: 150 LedgerEntries no Q1 2026 (10 por categoria); categorias: "Receita de Serviços" (R$50.000), "Receita Recorrente" (R$30.000), "Aluguel" (R$-9.000), "Folha de Pagamento" (R$-40.000), "Marketing" (R$-8.000), "Tecnologia/SaaS" (R$-5.000), "Impostos" (R$-12.000), "Fornecedores" (R$-15.000), "Benefícios" (R$-6.000), "Viagens" (R$-3.000), "Equipamentos" (R$-7.000), "Jurídico" (R$-4.000), "Contabilidade" (R$-3.500), "Outros Créditos" (R$2.000), "Outros Débitos" (R$-1.500); cada categoria com creditsCents ou debitsCents definidos precisamente

## Expected assertions
- status: 200
- table.length: == 15
- chart.length: == 1
- chart[0].period: == "2026-Q1"
- summary.totalCreditsCents: == 8200000 (R$82.000 = R$50k + R$30k + R$2k)
- summary.totalDebitsCents: == 11400000 (R$114.000 = soma dos débitos acima)
- table[*].totalCents: cada linha com o valor exato da categoria correspondente
- sum(table[*].totalCents onde crédito): == summary.totalCreditsCents
- sum(table[*].totalCents onde débito): == summary.totalDebitsCents
- latency_ms: < 600

## Justificativa
Valida a combinação de granularity=quarterly (menos comum) com alto número de categorias distintas. Confirma: (a) o formato de `period` muda para "YYYY-Qn" no modo quarterly; (b) a `table` retorna exatamente 15 linhas sem mesclar ou perder nenhuma categoria; (c) a integridade matemática é preservada — a soma dos totais por categoria deve bater com os totais do summary; (d) a performance é aceitável com JOIN + GROUP BY em 15 grupos. Qualquer discrepância nos totais indicaria bug na agregação SQL.
