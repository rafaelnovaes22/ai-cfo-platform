---
case_id: "action-plan-0008"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0008 — Varejo sazonal pós-feriado (Q4 -> Q1)

## Input
- DRE: receitaBruta R$60k (vs R$140k em dezembro), cmv R$36k, despesasPessoal R$15k (25%), ebitda R$2k
- NarrativeCards: [{type: "watch", title: "Receita -57% MoM — efeito sazonal Q1"}, {type: "highlight", title: "Q4/2025 fechou margem 12%"}, {type: "alert", title: "Margem janeiro 3% — capital de giro sob pressão"}]
- Tenant: industrySegment=varejo, taxRegime=simples, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Reconhecer sazonalidade — short focada em fluxo de caixa, não em corte estrutural"
  impacto_plausivel: "Ações short de R$1-4k (varejo pequeno); long pode propor produto/linha não-sazonal"
  doneWhen_executavel: "Ex: 'negociar prazo de pagamento de fornecedor X para 60d até DD/MM'"
```

## Justificativa
LLM precisa distinguir queda sazonal de crise. Plano de turnaround agressivo aqui é overreact. Judge espera ao menos 1 ação long endereçando dependência sazonal.
