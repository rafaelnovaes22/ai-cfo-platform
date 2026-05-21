---
case_id: "normalization-0010"
module: "monthly-analysis/normalization"
outcome: "preserve_amount_date"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0010 — Data em formato brasileiro e valor com separador local

## Input

```yaml
raw_entries:
  - description: "02/04/2026; PIX RECEBIDO CLIENTE BETA; R$ 1.234,56"
    direction: "credit"
    amountCents: 123456
    date: "2026-04-02"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Output ISO date 2026-04-02 e amountCents 123456; jamais reinterpretar como 1234.56 centavos."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
