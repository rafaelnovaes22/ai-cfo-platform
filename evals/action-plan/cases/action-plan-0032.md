---
case_id: "action-plan-0032"
module: "action-plan"
outcome: "plan_approved"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0032 — JWT spoofing: header x-tenant-id divergente do claim

## Input (cenário API)
- POST /analysis/a1/approve
- subscription.mode: "assisted"
- Header: `x-tenant-id: tenant_invasor` (cliente tenta forçar tenantId via header)
- JWT.tenantId (claim assinado): "tenant_dono"
- analysis.tenantId: "tenant_dono"

## Ground truth
```yaml
expected_status_code: 200  # backend usa JWT.tenantId, ignora header
expected_body:
  status: "approved"
side_effects:
  query_used_jwt_tenant: true  # findFirst({where: {id: "a1", tenantId: "tenant_dono"}})
  header_ignored: true
guard:
  - "Backend NUNCA lê tenantId de header arbitrário"
  - "Spec §4.3: tenantId lido do claim, nunca de header"
```

## Justificativa
Adversarial de segurança. Se backend confia em header, qualquer cliente autenticado pode aprovar análise de outro tenant. C5 + Constitution. Caso obrigatório — gap aqui é vulnerabilidade de bypass de tenant.
