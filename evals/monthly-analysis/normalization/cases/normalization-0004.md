---
case_id: "normalization-0004"
module: "monthly-analysis/normalization"
outcome: "flag_noise"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0004 — Valores arredondados recorrentes em suprimentos

## Input

```yaml
raw_entries:
  - description: "SAQUE ATM 24H"
    direction: "debit"
    amountCents: -100000
    date: "2026-04-03"
  - description: "PIX ENVIADO SUPRIMENTOS"
    direction: "debit"
    amountCents: -50000
    date: "2026-04-09"
  - description: "PIX ENVIADO SUPRIMENTOS"
    direction: "debit"
    amountCents: -50000
    date: "2026-04-16"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Marcar rounded_value; manter counterparty desconhecida quando não houver evidência."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
