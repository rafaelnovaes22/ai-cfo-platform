---
case_id: "action-plan-0012"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0012 — PME R$5M/mês (porte alto da banda)

## Input
- DRE: receitaBruta R$5M, cmv R$2,5M, despesasPessoal R$700k (14%), ebitda R$900k (18%)
- NarrativeCards: [{type: "healthy", title: "Margem operacional 18% sólida"}, {type: "highlight", title: "Folha em 14% — eficiente para indústria"}, {type: "watch", title: "Dependência de 1 cliente em 35% da receita"}]
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações de empresa madura: diversificação de carteira, M&A small, ESG, governança"
  impacto_plausivel: "Ações curtas R$30-100k; medium R$100-300k; long R$500k+"
  doneWhen_executavel: "Ex: 'reduzir dependência cliente A para <=25% até fim do ano fiscal'"
```

## Justificativa
Empresa grande precisa de plano em outra escala. Judge flag se LLM repete ações de pequeno porte (ex: "negociar telefonia") em base de R$5M.
