---
case_id: "dre-narrative-0006"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0006 — naoClassificado > 10% (warning não-bloqueante)

## Input (LedgerEntries agregados)
- 80 entries: 60 classificados (receitaBruta=R$ 50.000,00; cmv=R$ 20.000,00) + 20 sem `confirmedCategory` nem `predictedCategory` totalizando R$ 8.000,00
- Tenant: industrySegment=industria, taxRegime=lucroReal

## Ground truth (DRE esperado)
```yaml
receitaBruta: 5000000
receitaLiquida: 5000000
cmv: 2000000
lucroBruto: 3000000
naoClassificado: 800000     # 16% do total movimentado
totalDespesasOperacionais: 0
ebitda: 3000000
lucroLiquido: 3000000
margemLiquida: 0.6000
# nota: naoClassificado NÃO impede agregação; agregação segue completa
```

## Justificativa
Edge §5: `naoClassificado > 0` NÃO bloqueia. As 31 chaves saem normalmente. Frontend exibirá banner "20 lançamentos não classificados". Eval garante que o agregador não rejeita o caso e não joga `naoClassificado` em outra linha.
