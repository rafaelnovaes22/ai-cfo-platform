---
case_id: "action-plan-0023"
module: "action-plan"
outcome: "plan_approved"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case action-plan-0023 — ASSISTED: primeira aprovação (status ready → approved)

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "assisted"
- analysis.status: "ready"
- analysis.approvedAt: null
- JWT.tenantId == analysis.tenantId

## Ground truth
```yaml
expected_status_code: 200
expected_body:
  status: "approved"
  approvedAt: "ISO-8601"  # timestamp do servidor
idempotent: false  # primeira chamada — não testa idempotência aqui
side_effects:
  monthlyAnalysis_update_calls: 1
  approvedAt_set_to_now: true
```

## Justificativa
Caminho feliz canônico. Outcome `plan_approved` é satisfeito quando 3 condições batem: modo ASSISTED + transition ready→approved + approvedAt persistido. Caso P0 — qualquer regressão aqui derruba SLA contratual §1.2.
