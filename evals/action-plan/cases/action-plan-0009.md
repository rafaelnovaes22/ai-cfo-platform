---
case_id: "action-plan-0009"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0009 — Serviços com inadimplência alta (Contas a Receber 90d+)

## Input
- DRE: receitaBruta R$120k, ebitda R$18k, mas card destaca CR 90d+ R$45k (37% do faturamento)
- NarrativeCards: [{type: "alert", title: "Inadimplência 90d+ representa 37% do faturamento mensal"}, {type: "watch", title: "PMR (prazo médio de recebimento) em 78 dias"}]
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ao menos 2 ações curtas de cobrança/cred: política, atraso, mediação"
  impacto_plausivel: "Recuperar 30-50% do CR 90d+ = R$13-22k de caixa; reduzir PMR em 10d = R$X de capital de giro"
  doneWhen_executavel: "Ex: 'baixar PMR para <=60 dias em 90d', 'recuperar R$15k de CR 90d+ até DD/MM'"
```

## Justificativa
Caso onde P&L parece OK mas caixa está apertando. LLM tem tendência a ignorar inadimplência se DRE não mostra prejuízo. Judge flag se plano ignora o card de alerta.
