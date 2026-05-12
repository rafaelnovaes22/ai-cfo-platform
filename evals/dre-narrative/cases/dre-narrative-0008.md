---
case_id: "dre-narrative-0008"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0008 — CMV > 60% receitaBruta (regra §7)

## Input (LedgerEntries agregados)
- 40 entries `confirmed`, mês `2026-04`
- receitaBruta=R$ 100.000,00; cmv=R$ 65.000,00; despesasComerciais=R$ 5.000,00
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido

## Ground truth (DRE esperado)
```yaml
receitaBruta: 10000000
receitaLiquida: 10000000
cmv: 6500000
lucroBruto: 3500000
despesasComerciais: 500000
totalDespesasOperacionais: 500000
ebitda: 3000000
lucroLiquido: 3000000
margemBruta: 0.3500
margemLiquida: 0.3000
# checagem: cmv/receitaBruta == 0.65 > 0.60
```

## Justificativa
Ativa regra §7 "CMV > 60% receita bruta" para varejo (típico). Base para card `attention` no dre-narrative-0023. Valida margemBruta resultante (35%).
