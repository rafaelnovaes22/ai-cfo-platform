---
case_id: "action-plan-0024"
module: "action-plan"
outcome: "plan_approved"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0024 — ASSISTED: idempotência (segunda chamada retorna mesmo approvedAt)

## Input (cenário API)
- POST /analysis/a1/approve (chamada #2)
- subscription.mode: "assisted"
- analysis.status: "approved"
- analysis.approvedAt: "2026-05-10T12:00:00Z" (já aprovado anteriormente)

## Ground truth
```yaml
expected_status_code: 200
expected_body:
  status: "approved"
  approvedAt: "2026-05-10T12:00:00Z"  # preserva o original
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 0  # NÃO dispara novo update
  approvedAt_unchanged: true
```

## Justificativa
Spec §1.2 ex 3: double-click no botão. Outcome `plan_approved` conta UMA vez mesmo com N chamadas — billing não pode cobrar 2x. Caso P0 — falha aqui causa cobrança duplicada.
