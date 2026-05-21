---
case_id: "dre-narrative-0016"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0016 — 120 entries mistos confirmed/predicted

## Input (LedgerEntries agregados)
- 120 entries: 80 `confirmed` (receitaBruta=R$ 70.000,00; cmv=R$ 25.000,00; despesasComerciais=R$ 10.000,00) + 40 `predicted` (predictedCategory: despesasAdministrativas=R$ 8.000,00; despesasTecnologia=R$ 3.000,00)
- Nenhum entry tem `confirmedCategory` E `predictedCategory` simultaneamente
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido

## Ground truth (DRE esperado)
```yaml
receitaBruta: 7000000
receitaLiquida: 7000000
cmv: 2500000
lucroBruto: 4500000
despesasComerciais: 1000000
despesasAdministrativas: 800000        # via predictedCategory
despesasTecnologia: 300000             # via predictedCategory
totalDespesasOperacionais: 2100000
ebitda: 2400000
lucroLiquido: 2400000
margemLiquida: 34.29
naoClassificado: 0
```

## Justificativa
Exemplo POSITIVO §1.1.2: 80 confirmed + 40 predicted. Agregador usa `predictedCategory` quando `confirmedCategory == null`. Combina os dois sem dupla contagem. Caso típico de classificação parcial pelo módulo upstream.
