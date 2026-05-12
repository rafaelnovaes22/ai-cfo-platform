---
case_id: "action-plan-0011"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0011 — PME microempresa R$30k/mês (porte mínimo)

## Input
- DRE: receitaBruta R$30k, cmv R$12k, despesasPessoal R$8k (sócio + 1 funcionário), ebitda R$5k
- NarrativeCards: [{type: "healthy", title: "Margem 16% — saudável para porte"}, {type: "watch", title: "Dependência alta do sócio operacional"}]
- Tenant: industrySegment=servicos, taxRegime=mei, toneOfVoice=direto

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Ações compatíveis com porte — não recomendar contratação de CFO, software empresarial caro, etc."
  impacto_plausivel: "impactCents por ação <= R$6k (20% da receita); >R$10k flag alto"
  doneWhen_executavel: "Ex: 'documentar 3 processos críticos do sócio em planilha até fim do mês'"
```

## Justificativa
Plano genérico de "grande empresa" não cabe em microempresa. Judge flag se LLM sugere ferramentas/processos incompatíveis com porte (ex: ERP corporativo, head de RH).
