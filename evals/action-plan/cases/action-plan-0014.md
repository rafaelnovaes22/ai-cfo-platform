---
case_id: "action-plan-0014"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0014 — Tributação Simples vs Lucro Real (mesmo DRE)

## Input
- DRE: receitaBruta R$300k, cmv R$150k, ebitda R$45k
- NarrativeCards: padrão
- Tenant A: taxRegime=simples
- Tenant B: taxRegime=lucroReal (mesmo DRE — comparação)

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Tenant B (lucroReal) pode receber ação de planejamento tributário (créditos PIS/COFINS, despesas dedutíveis); Tenant A não"
  impacto_plausivel: "Ações tributárias para B com impactCents R$3-15k/mês"
  doneWhen_executavel: "Ex: 'mapear 3 categorias de despesa com credito PIS/COFINS não-aproveitado'"
```

## Justificativa
taxRegime é toggle relevante. Plano idêntico para Simples e Lucro Real é sinal de que LLM não está usando o L1. Judge espera divergência substantiva em ação tributária.
