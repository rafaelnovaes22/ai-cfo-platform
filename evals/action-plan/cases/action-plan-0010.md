---
case_id: "action-plan-0010"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0010 — Indústria com despesa financeira pesada (juros alto)

## Input
- DRE: receitaBruta R$1M, ebitda R$120k (12%), despesasFinanceiras R$80k, lucroLiquido R$30k (3%)
- NarrativeCards: [{type: "alert", title: "Despesa financeira consome 67% do ebitda"}, {type: "watch", title: "Capital de giro caro — taxa 2,8%/mês"}]
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações de estrutura de capital: renegociação bancária, antecipação de recebíveis, troca por crédito mais barato"
  impacto_plausivel: "Reduzir taxa de 2,8% para 1,8% em R$X dívida = economia mensurável"
  doneWhen_executavel: "Ex: 'fechar nova linha de capital de giro a <=1,8%a.m. até DD/MM'"
```

## Justificativa
Lucro operacional saudável corroído por juros. Plano de crescimento é erro — primeiro tem que estancar a sangria financeira. Long horizon ideal para diversificação de fontes de capital.
