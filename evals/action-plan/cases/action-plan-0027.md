---
case_id: "action-plan-0027"
module: "action-plan"
outcome: "plan_approved"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0027 — Cross-tenant: 404 (análise pertence a outro tenant)

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "assisted"
- JWT.tenantId: "tenant_invasor"
- analysis.tenantId: "tenant_dono" (diferente)

## Ground truth
```yaml
expected_status_code: 404
expected_body:
  error: "/not found/i"
idempotent: true
side_effects:
  monthlyAnalysis_update_calls: 0
  no_data_leak: true  # error message NÃO revela que análise existe em outro tenant
```

## Justificativa
Multi-tenancy obrigatório (Constitution C5 + spec §1.2 ex negativo 3). `findFirst({where: {id, tenantId}})` retorna null → 404. Importante: 404 (não 403) para não vazar existência de recurso.
