---
case_id: "action-plan-0007"
module: "action-plan"
outcome: "plan_generated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0007 — Re-geração após feedback (mesmo DRE) → planos similares

## Input
- DRE: idêntico ao action-plan-0001 (varejo saudável)
- NarrativeCards: idênticos
- Tenant: idêntico
- Cenário: segunda chamada de generateActionPlan após cliente ter dado feedback "rejected" em 2 itens

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  acionabilidade: "Mesma qualidade do 0001"
  consistencia: ">=60% das ações novas devem ter intent semanticamente similar às do 0001 (não pode reinventar plano)"
  doneWhen_executavel: "Idem 0001"
```

## Justificativa
Determinismo razoável: mesma entrada → planos com mesma direção estratégica. Se 2 runs com mesmo input geram planos totalmente divergentes, há problema de variância. Não exige idempotência exata (LLM ~stochastic).
