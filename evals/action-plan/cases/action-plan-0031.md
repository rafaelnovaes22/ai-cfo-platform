---
case_id: "action-plan-0031"
module: "action-plan"
outcome: "plan_approved"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0031 — Double-submit concorrente (race condition)

## Input (cenário API)
- 2 requests POST /analysis/a1/approve disparados em paralelo (Promise.all)
- subscription.mode: "assisted"
- analysis.status: "ready" no início
- DB: PostgreSQL real (não mock — race condition só aparece em PG)

## Ground truth
```yaml
expected_status_codes: [200, 200]  # ambos retornam 200
final_state:
  status: "approved"
  approvedAt: "first_request_timestamp"  # 2º request NÃO sobrescreve
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 1  # idealmente apenas 1 — gap §7 WARNING
note: |
  TEST-DRIFT documentado §7: sem SELECT FOR UPDATE, em PG real ambos podem
  passar o check `if (status === 'approved') return early` simultâneamente
  e disparar 2 UPDATEs. Eval expõe a condição.
```

## Justificativa
Edge case crítico se billing depende de `plan_approved` único. Gap conhecido §7 da spec ("WARNING — TODO Onda C adicionar lock SQL"). Caso documenta o risco para reviewer DeepAgent.
