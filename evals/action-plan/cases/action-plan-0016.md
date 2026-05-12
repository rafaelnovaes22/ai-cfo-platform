---
case_id: "action-plan-0016"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0016 — DRE com 3 cards todos do tipo "watch" (sem alerts nem highlights)

## Input
- DRE: receitaBruta R$180k, ebitda R$14k, margemLiquida 0.08 (zona cinza — nem ruim nem boa)
- NarrativeCards: [{type: "watch", title: "Margem em queda 2p.p."}, {type: "watch", title: "Despesa adm subindo lentamente"}, {type: "watch", title: "Ticket médio estável"}]
- Tenant: industrySegment=varejo, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Cenário 'nada gritante' — judge espera ações preventivas, não corte agressivo nem expansão"
  impacto_plausivel: "Ações de R$1-5k impacto; foco em monitoramento e ajuste fino"
  doneWhen_executavel: "Ex: 'criar acompanhamento semanal de ticket médio por categoria'"
```

## Justificativa
Zona neutra é o caso mais difícil — LLM tende a inventar urgência. Judge flag se plano usa tom alarmista sem evidência ou se vira "expansão" sem justificar.
