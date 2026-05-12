---
case_id: "action-plan-0018"
module: "action-plan"
outcome: "plan_generated"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0018 — doneWhen ausente do output LLM → schema falha → retry → falha

## Input
- DRE: válido
- LLM behavior: ambas tentativas retornam 5 short + 1 medium + 1 long mas com `doneWhen: null` em 2 itens
- Tenant: padrão

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: false
expected_behavior:
  retries: 2
  persisted_items: 0
  raises_error: true
  error_message_match: "/doneWhen|required|expected string/i"
```

## Justificativa
Commit f62d508 tornou doneWhen obrigatório (Zod refinement). Antes do fix isso passava silenciosamente (gap §7 da spec). Eval garante que regressão futura é detectada — schema deve rejeitar e propagar erro.
