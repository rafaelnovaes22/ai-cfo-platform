---
case_id: "dre-narrative-0005"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0005 — Receita negativa (estornos > vendas)

## Input (LedgerEntries agregados)
- 30 entries `confirmed`: 25 estornos somando R$ -50.000,00 + 5 vendas R$ 20.000,00
- cmv=R$ 5.000,00; despesasAdministrativas=R$ 2.000,00
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido

## Ground truth (DRE esperado)
```yaml
receitaBruta: -3000000      # negativo
deducoes: 0
receitaLiquida: -3000000
cmv: 500000
lucroBruto: -3500000
despesasAdministrativas: 200000
totalDespesasOperacionais: 200000
ebitda: -3700000
lucroLiquido: -3700000
margemBruta: null            # política: denominador <= 0 retorna null
margemLiquida: null
naoClassificado: 0
```

## Justificativa
Edge: receita bruta negativa (mês com mais estornos que vendas). Identidades contábeis devem permanecer corretas mesmo com sinal negativo. Margens viram `null` porque denominador `<= 0` é tratado como divisão inválida.
