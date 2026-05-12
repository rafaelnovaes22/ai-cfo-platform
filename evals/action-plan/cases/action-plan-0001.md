---
case_id: "action-plan-0001"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0001 — Varejo saudável (margem 15%) → plano de crescimento

## Input
- DRE: receitaBruta R$100k, ebitda R$22k, lucroLiquido R$14,25k, margemLiquida 0.15, despesasPessoal R$10k (10%)
- NarrativeCards: [{type: "healthy", title: "Mês saudável com margem 15%"}, {type: "highlight", title: "Margem bruta 47% é forte para o segmento"}, {type: "watch", title: "Despesas comerciais subindo 8%"}]
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}
required_fields_per_action: [horizon, title, description, effortLevel, riskLevel, impactCents, doneWhen]

judge_criteria:
  acionabilidade: "Ações devem ser de expansão/otimização, não corte. Verbos: 'expandir', 'testar', 'aumentar', 'lançar'"
  impacto_plausivel: "impactCents por ação <= R$20k (20% da receitaBruta R$100k); plano de crescimento típico"
  doneWhen_executavel: "Métricas observáveis: receita/categoria, ticket médio, taxa de conversão"
```

## Justificativa
PME varejo saudável é o cenário "expandir o que está dando certo". Plano de turnaround aqui seria erro grave de leitura — judge deve marcar acionabilidade baixa se LLM recomendar corte agressivo. Caso canônico para validar leitura de cenário positivo.
