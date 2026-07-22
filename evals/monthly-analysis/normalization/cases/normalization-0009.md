---
case_id: "normalization-0009"
module: "monthly-analysis/normalization"
outcome: "identify_document_type"
source_mode: "real"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0009 — Fatura de cartão com itens agregados

## Input

```yaml
raw_entries:
  - description: "PAGAMENTO FATURA CARTAO EMPRESARIAL FINAL 8842"
    direction: "debit"
    amountCents: -389000
    date: "2026-04-25"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "documentType card_statement/payment; não decompor itens sem evidência."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
