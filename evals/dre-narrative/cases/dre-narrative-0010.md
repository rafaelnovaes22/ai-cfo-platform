---
case_id: "dre-narrative-0010"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case dre-narrative-0010 — 31 linhas todas zero exceto receita

## Input (LedgerEntries agregados)
- 1 entry `confirmed`: receitaBruta=R$ 10.000,00
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 1000000
deducoes: 0
receitaLiquida: 1000000
cmv: 0
lucroBruto: 1000000
totalDespesasOperacionais: 0
ebitda: 1000000
depreciacao: 0
amortizacao: 0
lucroOperacional: 1000000
receitasFinanceiras: 0
despesasFinanceiras: 0
resultadoFinanceiro: 0
lucroAntesIR: 1000000
irCsll: 0
lucroLiquido: 1000000
margemBruta: 100
margemLiquida: 100
naoClassificado: 0
```

## Justificativa
Caso extremo: 1 lançamento, margem 100%. Garante que o agregador sempre emite as 31 chaves (não pula linhas zeradas). Identidades triviais devem bater.
