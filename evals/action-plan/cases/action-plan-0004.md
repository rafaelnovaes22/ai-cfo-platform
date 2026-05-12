---
case_id: "action-plan-0004"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0004 — Varejo com estoque parado → otimização de capital de giro

## Input
- DRE: receitaBruta R$150k, cmv R$90k, ebitda R$15k, margemLiquida 0.07
- NarrativeCards: [{type: "watch", title: "Giro de estoque caiu de 6x para 3x"}, {type: "alert", title: "Capital de giro 60 dias parado em mercadoria"}]
- Tenant: industrySegment=varejo, taxRegime=simples, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações específicas de varejo: liquidação SKU parado, mix de produto, política de compra"
  impacto_plausivel: "Liquidação de SKU pode liberar R$5-20k de caixa; ação medium de mix pode trazer R$3-8k/mês recorrente"
  doneWhen_executavel: "Ex: 'reduzir cobertura de estoque de 60 para 40 dias até DD/MM'"
```

## Justificativa
Cenário típico varejo onde fluxo de caixa importa mais que P&L. Ações genéricas ("reduzir despesas") falham — judge espera especificidade varejista (SKU, giro, markup).
