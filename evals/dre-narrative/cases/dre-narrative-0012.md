---
case_id: "dre-narrative-0012"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0012 — Identidade EBITDA com depreciação e amortização

## Input (LedgerEntries agregados)
- 70 entries `confirmed`
- receitaBruta=R$ 200.000,00; cmv=R$ 80.000,00; despesasAdministrativas=R$ 30.000,00; despesasPessoal=R$ 40.000,00; depreciacao=R$ 5.000,00; amortizacao=R$ 2.000,00
- Tenant: industrySegment=industria, taxRegime=lucroReal

## Ground truth (DRE esperado)
```yaml
receitaBruta: 20000000
receitaLiquida: 20000000
cmv: 8000000
lucroBruto: 12000000
despesasAdministrativas: 3000000
despesasPessoal: 4000000
totalDespesasOperacionais: 7000000
ebitda: 5000000
depreciacao: 500000
amortizacao: 200000
lucroOperacional: 4300000     # ebitda - dep - amort
lucroLiquido: 4300000
margemEbitda: 25
margemOperacional: 21.5
margemLiquida: 21.5
```

## Justificativa
Valida a identidade `lucroOperacional == ebitda - depreciacao - amortizacao` (§1.1). Depreciação NÃO entra em `totalDespesasOperacionais` (entra abaixo do EBITDA). Erro comum: somar dep/amort em despesas e zerar a linha de baixo.
