---
case_id: "action-plan-0021"
module: "action-plan"
outcome: "plan_generated"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0021 — impactCents irreal (>R$1M/mês para PME R$500k faturamento)

## Input
- DRE: receitaBruta R$500k/mês
- LLM behavior: retorna plano válido pelo schema mas com 1 ação `impactCents: 200_000_00` (R$2M/mês — 4x a receita) — alucinação clássica
- Tenant: padrão

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true  # schema só checa tipo, não plausibilidade
judge_criteria:
  impacto_plausivel: "Judge MUST flag baixo (1-2/5). impactCents > 20% da receitaBruta da análise → alerta"
  heuristica: "Para receita R$500k, impacto por ação <=R$100k é plausível; >R$300k flag médio; >R$500k flag alto"
expected_judge_score_impacto: "<=2"  # caso deve falhar a rubrica de impacto
```

## Justificativa
Schema binário não pega alucinação numérica. LLM-as-judge é a defesa. Risco §11 da spec ("alucinação de impactCents"). Test garante que judge tem rubrica calibrada para detectar.
