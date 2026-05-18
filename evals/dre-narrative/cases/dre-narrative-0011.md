---
case_id: "dre-narrative-0011"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0011 — Margem borderline 4,99% (crítico) vs 5,01% (não-crítico)

## Input (LedgerEntries agregados)
- Variante A: receitaBruta=R$ 100.000,00; cmv=R$ 50.000,00; despesasOperacionais totais=R$ 45.010,00 → margem líquida = 4,99%
- Variante B (mesmo case_id reaproveitável): cmv=R$ 49.990,00; despesas totais=R$ 45.010,00 → margem 5,01%

## Ground truth (DRE esperado — variante A)
```yaml
receitaBruta: 10000000
receitaLiquida: 10000000
cmv: 5000000
lucroBruto: 5000000
totalDespesasOperacionais: 4501000
ebitda: 499000
lucroLiquido: 499000
margemLiquida: 4.99        # 4,99% — ABAIXO do threshold §7
```

## Justificativa
Borderline contra regra §7 "Margem líquida < 5% crítico". Valida arredondamento decimal(5,4): 0.0499 ≠ 0.0500. Garante que o agregador não arredonda para cima e mascara o crítico.
