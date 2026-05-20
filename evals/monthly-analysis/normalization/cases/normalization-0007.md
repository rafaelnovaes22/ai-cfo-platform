---
case_id: "normalization-0007"
module: "monthly-analysis/normalization"
outcome: "preserve_amount_date"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0007 — Estorno parcial de adquirente

## Input

```yaml
raw_entries:
  - description: "ESTORNO CREDITO REDE TX CANCELAMENTO"
    direction: "debit"
    amountCents: -32000
    date: "2026-04-22"
  - description: "VENDA CRED REDE LOTE 8821"
    direction: "credit"
    amountCents: 510000
    date: "2026-04-22"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Não trocar sinal do estorno; documentType bank_statement; evidenceRaw aponta descrição original."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
