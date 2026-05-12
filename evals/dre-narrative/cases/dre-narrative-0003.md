---
case_id: "dre-narrative-0003"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0003 — Folha desproporcional (pessoal+prolabore = 40% da RL)

## Input (LedgerEntries agregados)
- 55 entries `confirmed`, mês `2026-04`
- receitaBruta=R$ 100.000,00; deducoes=R$ 0; cmv=R$ 30.000,00; despesasPessoal=R$ 30.000,00; prolabore=R$ 10.000,00; despesasAdministrativas=R$ 8.000,00
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 10000000
receitaLiquida: 10000000
cmv: 3000000
lucroBruto: 7000000
despesasPessoal: 3000000
prolabore: 1000000
despesasAdministrativas: 800000
totalDespesasOperacionais: 4800000
ebitda: 2200000
lucroLiquido: 2200000
margemLiquida: 0.2200
# checagem chave: (despesasPessoal + prolabore) / receitaLiquida == 0.40
```

## Justificativa
Ativa a regra §7 "Pessoal + prolabore > 40% receita líquida" — borderline exato (40%). Base para card `attention` no dre-narrative-0019. Valida que prolabore é linha separada de despesasPessoal.
