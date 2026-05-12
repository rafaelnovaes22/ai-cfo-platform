---
case_id: "action-plan-0002"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0002 — Serviços em crise (margem -5%) → turnaround

## Input
- DRE: receitaBruta R$80k, ebitda -R$4k, lucroLiquido -R$4k, margemLiquida -0.05, despesasPessoal R$32k (40%), despesasAdministrativas R$15k
- NarvativeCards: [{type: "alert", title: "Margem negativa pelo 2º mês seguido"}, {type: "alert", title: "Folha consome 40% da receita"}, {type: "watch", title: "Receita caiu 12% MoM"}]
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações de turnaround: corte de custo, renegociação, suspensão de não-essenciais. Verbos: 'reduzir', 'renegociar', 'pausar', 'cortar'"
  impacto_plausivel: "Ações short com impacto R$2-10k (corte concreto); long pode chegar a R$15k (reestruturação)"
  doneWhen_executavel: "Ex: 'reduzir telefonia para <= R$X até DD/MM', 'renegociar aluguel ate fim do mês'"
```

## Justificativa
Cenário oposto ao 0001 — empresa precisa parar de sangrar. Plano de crescimento aqui é gravíssimo (queima caixa que não existe). Judge deve flaggar low acionabilidade se LLM sugerir "investir em marketing" ou "expandir time".
