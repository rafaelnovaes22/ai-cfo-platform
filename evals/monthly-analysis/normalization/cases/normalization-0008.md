---
case_id: "normalization-0008"
module: "monthly-analysis/normalization"
outcome: "flag_noise"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0008 — Lançamento sem contraparte clara

## Input

```yaml
raw_entries:
  - description: "DEB AUT 0000000000047"
    direction: "debit"
    amountCents: -14990
    date: "2026-04-07"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "counterparty null/unknown; noiseFlags inclui unknown_counterparty; não inventar fornecedor."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
