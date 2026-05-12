---
case_id: "action-plan-0028"
module: "action-plan"
outcome: "plan_approved"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0028 — ASSISTED + status="processing" → 409 ou 422 (análise não pronta)

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "assisted"
- analysis.status: "processing" (worker ainda gerando plano)

## Ground truth
```yaml
expected_status_code: [409, 422]  # conflict ou unprocessable
expected_body:
  error: "/not ready|processing|invalid transition/i"
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 0
  approvedAt_set: false
note: |
  Caso pode revelar GAP no backend atual (TEST-DRIFT) — verificar se a rota
  valida status antes de aprovar. Se não valida, cliente pode "aprovar" análise
  ainda em geração, o que quebra contrato de outcome (§1.2).
```

## Justificativa
Spec §1.2: aprovação requer transition `ready → approved`. Outras transições devem falhar. Sinaliza possível gap se backend permite approve em status arbitrário.
