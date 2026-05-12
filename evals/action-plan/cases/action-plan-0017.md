---
case_id: "action-plan-0017"
module: "action-plan"
outcome: "plan_generated"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0017 — Retry esgotado: LLM falha 2x, plano NÃO persiste

## Input
- DRE: válido (qualquer cenário do 0001-0010)
- LLM behavior: 1ª chamada retorna 2 short + 1 medium + 1 long (falta 1 short); 2ª chamada retorna 3 short + 0 medium + 1 long (falta medium)
- Tenant: padrão

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: false  # ambas tentativas falham nos mínimos
expected_behavior:
  retries: 2
  persisted_items: 0  # NÃO pode persistir plano incompleto
  raises_error: true
  error_message_match: "/horizontes mínimos|min(1)|min(3)|long|medium/i"
  monthlyAnalysis_status: "processing"  # NÃO transiciona para ready/delivered
```

## Justificativa
Hard gate de outcome — se mínimos não são atendidos após retry, o plano não conta como `plan_generated` e o sistema não pode "fingir sucesso". Caso BLOCKER do review da spec §7. Validação binária.
