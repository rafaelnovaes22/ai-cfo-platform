---
case_id: "dre-narrative-0013"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0013 — Identidade resultado financeiro

## Input (LedgerEntries agregados)
- 50 entries `confirmed`
- receitaBruta=R$ 100.000,00; cmv=R$ 50.000,00; despesasOperacionais=R$ 30.000,00; receitasFinanceiras=R$ 3.000,00; despesasFinanceiras=R$ 8.000,00; irCsll=R$ 4.500,00
- Tenant: industrySegment=servicos, taxRegime=lucroPresumido

## Ground truth (DRE esperado)
```yaml
receitaBruta: 10000000
receitaLiquida: 10000000
cmv: 5000000
lucroBruto: 5000000
totalDespesasOperacionais: 3000000
ebitda: 2000000
lucroOperacional: 2000000
receitasFinanceiras: 300000
despesasFinanceiras: 800000
resultadoFinanceiro: -500000           # receitas - despesas
lucroAntesIR: 1500000                  # lucroOperacional + resultadoFinanceiro
irCsll: 450000
lucroLiquido: 1050000                  # lucroAntesIR - irCsll
margemLiquida: 0.1050
```

## Justificativa
Valida identidade `lucroLiquido = lucroOperacional - despesasFinanceiras + receitasFinanceiras - irCsll`. Sinais de `resultadoFinanceiro` são tradicionais (despesa subtrai). Importante para tenants com alavancagem bancária.
