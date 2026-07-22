---
case_id: "classification-0030"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case classification-0030 — Boundary 0.6999 (confidence borderline)

## Input (LedgerEntry)
- `description`: "PAGAMENTO RH SERVICOS LTDA NF 7788"
- `amountCents`: 320000
- `direction`: "debit"
- `date`: "2026-04-18"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "despesas_juridicas"
expected_confidence_min: 0.60
expected_confidence_max: 0.6999
acceptable_alternatives: ["despesas_pessoal", "despesas_administrativas", "custo_servicos"]
```

## Justificativa
"RH Serviços Ltda" parece folha de pagamento (`despesas_pessoal`) mas é fornecedor de consultoria de RH (`despesas_juridicas`/consultoria). Caso adversarial-real: modelo deve oscilar e cair em `<0.70` — boundary estrito do limiar.

## Tags
edge, boundary-0.6999, adversarial-real
