---
case_id: "dre-narrative-0001"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0001 — PME varejo lucrativa com 62 lançamentos confirmados

## Input (LedgerEntries agregados)
- 62 entries `confirmed` do tenant `tenant-test-001`, mês `2026-04`
- Composição: receitaBruta=R$ 100.000,00; deducoes=R$ 5.000,00; cmv=R$ 50.000,00; despesasComerciais=R$ 8.000,00; despesasAdministrativas=R$ 5.000,00; despesasPessoal=R$ 10.000,00; despesasFinanceiras=R$ 2.000,00; irCsll=R$ 5.750,00
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido

## Ground truth (DRE esperado)
```yaml
receitaBruta: 10000000      # centavos
deducoes: 500000
receitaLiquida: 9500000
cmv: 5000000
lucroBruto: 4500000
despesasComerciais: 800000
despesasAdministrativas: 500000
despesasPessoal: 1000000
totalDespesasOperacionais: 2300000
ebitda: 2200000
lucroOperacional: 2200000
despesasFinanceiras: 200000
lucroAntesIR: 2000000
irCsll: 575000
lucroLiquido: 1425000
margemBruta: 47.37
margemLiquida: 15
naoClassificado: 0
```

## Justificativa
PME varejo lucrativa (margem líquida 15%). Caso canônico exercitando todas identidades contábeis e precedência `confirmedCategory`. Expectativa: agregador retorna 31 chaves, identidades batem, `naoClassificado == 0`. Base para o card `healthy` no dre-narrative-0017.
