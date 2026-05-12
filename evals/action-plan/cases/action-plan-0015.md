---
case_id: "action-plan-0015"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0015 — DRE com naoClassificado relevante (>10%)

## Input
- DRE: receitaBruta R$200k, ebitda R$30k, naoClassificado R$25k (12% da receita)
- NarrativeCards: [{type: "alert", title: "12% das despesas sem categoria — DRE incompleto"}, {type: "watch", title: "Análise pode estar enviesada por classificações pendentes"}]
- Tenant: industrySegment=servicos, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ao menos 1 ação short deve abordar classificação/categorização dos R$25k pendentes"
  impacto_plausivel: "Ação de categorização tem impactCents baixo direto (R$0-2k), mas alto indireto (qualidade da próxima análise)"
  doneWhen_executavel: "Ex: 'classificar 100% dos lançamentos em hub até dia 10 do próximo fechamento'"
```

## Justificativa
Quando o próprio dado está incompleto, plano de ação tem que apontar isso primeiro. LLM ignorar o naoClassificado e dar plano "normal" é regressão de qualidade. Judge flag se nenhuma ação aborda categorização.
