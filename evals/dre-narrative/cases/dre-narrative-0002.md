---
case_id: "dre-narrative-0002"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0002 — PME serviços em crise (margem líquida -5%)

## Input (LedgerEntries agregados)
- 48 entries `confirmed`, mês `2026-04`
- receitaBruta=R$ 80.000,00; deducoes=R$ 4.000,00; cmv=R$ 30.000,00; despesasPessoal=R$ 40.000,00; despesasAdministrativas=R$ 5.000,00; despesasOcupacao=R$ 4.800,00; despesasFinanceiras=R$ 0
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 8000000
deducoes: 400000
receitaLiquida: 7600000
cmv: 3000000
lucroBruto: 4600000
despesasPessoal: 4000000
despesasAdministrativas: 500000
despesasOcupacao: 480000
totalDespesasOperacionais: 4980000
ebitda: -380000
lucroOperacional: -380000
lucroLiquido: -380000
margemLiquida: -0.0500
naoClassificado: 0
```

## Justificativa
PME serviços com prejuízo. Exercita margem líquida negativa (formato BR `-5,00%`). Base para card `critical_gap` no dre-narrative-0018. Identidade: `lucroOperacional = ebitda - 0 - 0` e `lucroLiquido = lucroOperacional + 0 - 0`.
