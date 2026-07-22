---
case_id: "normalization-0005"
module: "monthly-analysis/normalization"
outcome: "identify_document_type"
source_mode: "real"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0005 — Notas fiscais misturadas com comprovantes de pagamento

## Input

```yaml
raw_entries:
  - description: "NF-e 5567 MERCADORIAS CONFEC LTDA"
    direction: "debit"
    amountCents: -765000
    date: "2026-04-12"
  - description: "COMPROVANTE TED CONFEC LTDA NF 5567"
    direction: "debit"
    amountCents: -765000
    date: "2026-04-13"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Distinguir invoice vs payment_receipt; flag duplicate_suspect só como suspeita, não zerar valor."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
