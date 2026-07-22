---
case_id: "ingest-0035"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case ingest-0035 — Mesmo mês, tenant diferente cria análises isoladas

## Input
- `source`: csv
- `payload`: dois clientes reais (tenantA e tenantB, ambos PMEs distintas) — tenantA já tem MonthlyAnalysis para 2026-04 ingerida ontem; hoje tenantB faz seu primeiro upload de 70 linhas para 2026-04
- `tenantId`: "tenant-test-035-B"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-independent-from-tenantA>",
  "entryCount": 70,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called with tenantId='tenant-test-035-B'; no cross-tenant leak"
}
```

## Justificativa
R6 multi-tenancy + §1.4 unicidade por par. Garante isolamento — duas análises separadas no mesmo mês.

## Tags
real, multi-tenant, side-effect, isolation, cross-tenant-anti-leak
