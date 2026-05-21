---
case_id: "dre-narrative-0009"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0009 — Lucro extraordinário (outrasReceitasOperacionais grande)

## Input (LedgerEntries agregados)
- 50 entries `confirmed`, mês `2026-04`
- receitaBruta=R$ 80.000,00; cmv=R$ 40.000,00; outrasReceitasOperacionais=R$ 50.000,00 (venda de imobilizado, não-recorrente); despesasAdministrativas=R$ 10.000,00
- Tenant: industrySegment=industria, taxRegime=lucroReal

## Ground truth (DRE esperado)
```yaml
receitaBruta: 8000000
receitaLiquida: 8000000
cmv: 4000000
lucroBruto: 4000000
outrasReceitasOperacionais: 5000000
despesasAdministrativas: 1000000
totalDespesasOperacionais: -4000000   # outras receitas reduzem total
ebitda: 8000000
lucroLiquido: 8000000
margemLiquida: 100                  # margem >100% sinaliza não-recorrente
```

## Justificativa
Mês atípico: margem líquida >100% indica receita não-recorrente. Agregador NÃO deve filtrar/flagar — apenas computa. Base para o narrator no dre-narrative-0027 detectar e mencionar "não-recorrência".
