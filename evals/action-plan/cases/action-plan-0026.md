---
case_id: "action-plan-0026"
module: "action-plan"
outcome: "plan_approved"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0026 — AUTONOMOUS: POST /approve → 403 (não se aplica)

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "autonomous"
- analysis.status: "delivered" (worker já marcou)

## Ground truth
```yaml
expected_status_code: 403
expected_body:
  error: "/forbidden|mode|autonomous|not assisted/i"
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 0
```

## Justificativa
Spec §6 nota²: em AUTONOMOUS o worker transiciona para `delivered` automaticamente; não há aprovação manual. Endpoint deve negar para não confundir o estado. Commit 2e44531 fix.
