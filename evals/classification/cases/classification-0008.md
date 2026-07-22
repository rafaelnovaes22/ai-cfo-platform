---
case_id: "classification-0008"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0008 — Rendimento de aplicação financeira

## Input (LedgerEntry)
- `description`: "RENDIMENTO CDB BANCO XP ABR/2026"
- `amountCents`: 12500
- `direction`: "credit"
- `date`: "2026-04-30"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "receita_financeira"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Rendimento de CDB/aplicação é receita financeira por definição. Taxonomia tem categoria explícita `receita_financeira` (juros recebidos, rendimentos).

## Tags
real, cdb, receita-financeira
