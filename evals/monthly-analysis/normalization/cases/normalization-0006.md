---
case_id: "normalization-0006"
module: "monthly-analysis/normalization"
outcome: "preserve_semantics"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0006 — Reembolso de sócio confundível com receita

## Input

```yaml
raw_entries:
  - description: "PIX RECEBIDO JOAO SOCIO REEMB DESP VIAGEM"
    direction: "credit"
    amountCents: 95000
    date: "2026-04-20"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Manter direção credit e valor; description limpa deve preservar "reembolso" para evitar receita operacional falsa."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
