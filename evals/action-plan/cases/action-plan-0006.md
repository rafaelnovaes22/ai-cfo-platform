---
case_id: "action-plan-0006"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0006 — Indústria com CMV crescendo → renegociação de insumo

## Input
- DRE: receitaBruta R$800k, cmv R$520k (CMV 65%, vs 58% mês anterior), ebitda R$60k, margemLiquida 0.04
- NarrativeCards: [{type: "alert", title: "CMV subiu 7p.p. em 60 dias"}, {type: "watch", title: "Indício de inflação de insumo X"}]
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações específicas: cotação alternativa de insumo, repasse de preço, ficha técnica"
  impacto_plausivel: "Recuperar 3p.p. de margem em base R$800k = R$24k/mês — plausível"
  doneWhen_executavel: "Ex: 'cotar 3 fornecedores alternativos do insumo X até DD/MM', 'aprovar reajuste de tabela de >=4% no SKU Y'"
```

## Justificativa
Pressão de margem em indústria pede ações nos dois lados (custo + preço). Judge espera que long horizon traga ação estrutural (verticalização, contrato anual) — só "cotar fornecedor" repetido 5x é shallow.
