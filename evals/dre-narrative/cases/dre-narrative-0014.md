---
case_id: "dre-narrative-0014"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0014 — Despesas financeiras > 15% lucro operacional

## Input (LedgerEntries agregados)
- 60 entries `confirmed`
- receitaBruta=R$ 100.000,00; cmv=R$ 40.000,00; despesasOperacionais=R$ 40.000,00; despesasFinanceiras=R$ 4.000,00 (juros de empréstimo)
- Tenant: industrySegment=industria, taxRegime=lucroReal

## Ground truth (DRE esperado)
```yaml
receitaBruta: 10000000
receitaLiquida: 10000000
cmv: 4000000
lucroBruto: 6000000
totalDespesasOperacionais: 4000000
ebitda: 2000000
lucroOperacional: 2000000
despesasFinanceiras: 400000
resultadoFinanceiro: -400000
lucroAntesIR: 1600000
lucroLiquido: 1600000
margemLiquida: 16
# checagem: despesasFinanceiras/lucroOperacional == 0.20 > 0.15
```

## Justificativa
Ativa regra §7 "Despesas financeiras > 15% lucro operacional". Base para card `attention` no dre-narrative-0030. Indústria alavancada típica.
