---
case_id: "action-plan-0005"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0005 — Serviços B2B com CAC alto → otimização comercial

## Input
- DRE: receitaBruta R$200k, despesasComerciais R$45k (22%), despesasPessoal R$70k (35%), ebitda R$25k
- NarrativeCards: [{type: "watch", title: "Despesa comercial cresceu 30% sem aumento proporcional de receita"}, {type: "highlight", title: "Margem bruta de serviço em 70%"}]
- Tenant: industrySegment=servicos, taxRegime=lucroPresumido, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações de CAC/funil: pricing, qualificação de lead, cross-sell base atual"
  impacto_plausivel: "Reduzir CAC em 10-20% gera R$4-9k/mês; cross-sell base R$3-6k"
  doneWhen_executavel: "Ex: 'aumentar taxa de conversão de proposta para >=25% em 60d'"
```

## Justificativa
Em serviços B2B, despesa comercial sem retorno é sinal de funil quebrado. Plano deve atacar pricing/qualificação, não pedir "mais leads". Judge flag se receita é solução por força bruta.
