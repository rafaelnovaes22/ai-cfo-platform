---
case_id: "dre-narrative-0004"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0004 — Divisão por zero (receitaBruta == 0)

## Input (LedgerEntries agregados)
- 12 entries `confirmed` (PJ recém-aberta, mês `2026-04`, sem faturamento)
- receitaBruta=0; despesasOcupacao=R$ 3.000,00; despesasAdministrativas=R$ 1.500,00
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 0
deducoes: 0
receitaLiquida: 0
cmv: 0
lucroBruto: 0
despesasOcupacao: 300000
despesasAdministrativas: 150000
totalDespesasOperacionais: 450000
ebitda: -450000
lucroLiquido: -450000
margemBruta: null
margemOperacional: null
margemEbitda: null
margemLiquida: null
naoClassificado: 0
```

## Justificativa
Edge: receitaBruta==0 → margens devem ser `null` (não `NaN`, não `0`), conforme §4 da spec. Agregador NÃO deve quebrar. Valida política de divisão por zero.
