---
case_id: "action-plan-0029"
module: "action-plan"
outcome: "plan_approved"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0029 — ASSISTED: aprovação após feedback PATCH em 2 itens

## Input (cenário API)
- Sequência:
  1. PATCH /analysis/a1/action-plan/i1/feedback {approved: true}
  2. PATCH /analysis/a1/action-plan/i2/feedback {approved: false, comment: "alto risco"}
  3. POST /analysis/a1/approve
- subscription.mode: "assisted"
- analysis.status: "ready" antes da step 3

## Ground truth
```yaml
expected_status_code: 200
expected_body:
  status: "approved"
  approvedAt: "ISO-8601"
side_effects:
  feedback_preserved: true  # clientApproved/clientComment nos itens i1, i2 NÃO são apagados pelo approve
  monthlyAnalysis_update_calls: 1
```

## Justificativa
Spec §1.2 ex positivo 1. Cliente revisa, marca feedback item a item, fecha o mês. Approve não pode resetar feedback. Fluxo real ASSISTED.
