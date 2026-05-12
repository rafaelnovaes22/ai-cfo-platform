---
case_id: "action-plan-0030"
module: "action-plan"
outcome: "plan_approved"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0030 — ASSISTED: análise inexistente → 404

## Input (cenário API)
- POST /analysis/inexistente_xyz/approve
- subscription.mode: "assisted"
- JWT.tenantId: válido

## Ground truth
```yaml
expected_status_code: 404
expected_body:
  error: "/not found/i"
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 0
```

## Justificativa
Sanity check de path inválido. findFirst retorna null → 404. Não confundir com 403 (modo errado) — id que não existe sempre é 404.
