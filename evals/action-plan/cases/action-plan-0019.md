---
case_id: "action-plan-0019"
module: "action-plan"
outcome: "plan_generated"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0019 — impactCents zero → schema rejeita (.positive())

## Input
- DRE: válido (varejo saudável)
- LLM behavior: retorna 5 short + 1 medium + 1 long, mas 1 ação com `impactCents: 0` (ex: "implantar reunião semanal de fechamento")
- Tenant: padrão

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: false  # se o schema atual exige .positive() (>0)
expected_behavior:
  retries: 1  # primeira tentativa falha no schema
  raises_error_after_retry: true  # se a 2a também tiver impactCents=0
  error_message_match: "/impactCents|positive|greater than 0/i"
note: |
  AMBIGUIDADE: spec original aceita impactCents>=0 (ex 3 do POSITIVOS).
  Commit f62d508 endureceu para .positive() (>0). Eval testa o estado pós-fix.
  Se schema voltar a aceitar 0, este caso vira POSITIVE (não falha).
```

## Justificativa
Ações de governança (sem impacto financeiro direto) são prática comum no plano, mas hoje o schema rejeita. Test documenta o trade-off e fixa o contrato atual. Bandeira para revisão futura: voltar a permitir impactCents=0 + flag separado `governance: boolean`.
