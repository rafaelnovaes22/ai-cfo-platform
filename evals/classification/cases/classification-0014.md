---
case_id: "classification-0014"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0014 — Passagem aérea executiva

## Input (LedgerEntry)
- `description`: "LATAM AIRLINES PASSAGEM SAO/REC VIAGEM CLIENTE"
- `amountCents`: 145000
- `direction`: "debit"
- `date`: "2026-04-22"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "despesas_viagem"
expected_confidence_min: 0.90
acceptable_alternatives: []
```

## Justificativa
Passagem aérea com finalidade declarada de visita a cliente é `despesas_viagem` (categoria agrega passagens/hospedagem/refeições de negócios).

## Tags
real, viagem, passagem
