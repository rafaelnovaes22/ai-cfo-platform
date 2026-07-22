---
case_id: "classification-0009"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0009 — Aquisição de equipamento (CAPEX)

## Input (LedgerEntry)
- `description`: "COMPRA NOTEBOOK DELL XPS NF 9876 IMOBILIZADO"
- `amountCents`: 1200000
- `direction`: "debit"
- `date`: "2026-04-18"
- `tenant_context`: { industrySegment: "tecnologia", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "capex"
expected_confidence_min: 0.85
acceptable_alternatives: ["despesas_ti"]
```

## Justificativa
Notebook com valor relevante registrado como "IMOBILIZADO" indica CAPEX (ativo permanente, depreciável). Sem palavra-chave imobilizado, modelo poderia confundir com `despesas_ti` (alternativa aceitável quando contador opta por despesa direta).

## Tags
real, capex, imobilizado, hardware
