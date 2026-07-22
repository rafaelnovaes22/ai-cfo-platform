---
case_id: "normalization-0003"
module: "monthly-analysis/normalization"
outcome: "flag_noise"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0003 — Duplicidade suspeita em boletos pagos no mesmo minuto

## Input

```yaml
raw_entries:
  - description: "PAG BOLETO FORN XPTO 9981"
    direction: "debit"
    amountCents: -231450
    date: "2026-04-10T09:31:00"
  - description: "PAG BOLETO FORN XPTO 9981"
    direction: "debit"
    amountCents: -231450
    date: "2026-04-10T09:31:37"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Marcar duplicate_suspect em ambas; não remover nem consolidar lançamentos."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
