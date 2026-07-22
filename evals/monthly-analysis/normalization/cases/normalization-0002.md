---
case_id: "normalization-0002"
module: "monthly-analysis/normalization"
outcome: "clean_normalize"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0002 — CSV de ERP com acentos quebrados e centro de custo

## Input

```yaml
raw_entries:
  - description: "NF 3345 SERVIÃ‡OS CONTABEIS LTDA"
    direction: "debit"
    amountCents: -180000
    date: "2026-04-02"
  - description: "RECEITA NF 991 CLIENTE ALFA - CC Comercial"
    direction: "credit"
    amountCents: 420000
    date: "2026-04-05"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Normalizar encoding no texto sem alterar valor; extrair centro de custo quando explícito."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
