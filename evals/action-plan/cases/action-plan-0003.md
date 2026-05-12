---
case_id: "action-plan-0003"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0003 — Indústria com folha alta (40%) → revisão de quadro

## Input
- DRE: receitaBruta R$500k, despesasPessoal R$200k (40%), cmv R$220k, ebitda R$40k, margemLiquida 0.05
- NarrativeCards: [{type: "watch", title: "Folha em 40% — referência indústria é 22-28%"}, {type: "highlight", title: "CMV controlado em 44%"}, {type: "alert", title: "Margem operacional fina (8%)"}]
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ao menos 1 ação medium ou long deve abordar revisão de quadro/produtividade. Verbos: 'avaliar headcount', 'redimensionar', 'terceirizar'"
  impacto_plausivel: "Ação de quadro com impactCents R$10-30k/mês é plausível (1-2 posições); >R$80k flag alto"
  doneWhen_executavel: "Ex: 'concluir avaliação de produtividade do time X em 45 dias', 'reduzir folha para <=32% até trimestre'"
```

## Justificativa
Quando despesa de pessoal extrapola benchmark, plano deve abordar (mesmo com tom diplomático). Se LLM evita o tema, judge marca acionabilidade baixa. Long horizon ideal para reestruturação (substituição não rola em 30d).
