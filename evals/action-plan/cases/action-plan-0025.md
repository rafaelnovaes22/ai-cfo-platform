---
case_id: "action-plan-0025"
module: "action-plan"
outcome: "plan_approved"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0025 — SHADOW: POST /approve → 403 (C4 enforcement)

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "shadow"
- analysis.status: "ready"

## Ground truth
```yaml
expected_status_code: 403
expected_body:
  error: "/forbidden|mode|shadow|not assisted/i"
idempotent: true  # múltiplas chamadas em SHADOW seguem retornando 403
side_effects:
  monthlyAnalysis_update_calls: 0
  approvedAt_set: false
```

## Justificativa
Spec §6 + commit 2e44531: `requireMode("assisted")` bloqueia SHADOW. Em SHADOW o cliente nem deveria ver o plano. Falha em bloquear aqui quebra C4 (cliente "aprova" análise que humano ainda não revisou).
