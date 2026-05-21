---
case_id: "normalization-0001"
module: "monthly-analysis/normalization"
outcome: "clean_normalize"
source_mode: "real"
priority: "P0"
created_at: "2026-05-20"
---

# Case normalization-0001 — Extrato varejo com POS, tarifas e descrições sujas

## Input

```yaml
raw_entries:
  - description: "CR PIX RECEBIDO LOJA 02 *** 15/04"
    direction: "credit"
    amountCents: 125000
    date: "2026-04-15"
  - description: "DB TAR PACOTE SERVICOS C/C"
    direction: "debit"
    amountCents: -9900
    date: "2026-04-16"
  - description: "VENDA CRED REDE 123456 PARC 02/03"
    direction: "credit"
    amountCents: 87000
    date: "2026-04-17"
tenant_context:
  industrySegment: varejo_servicos
  taxRegime: simplesNacional
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
amount_and_date_must_be_preserved: true
expected_behavior: "Preservar datas/valores; limpar contraparte; documentType bank_statement; noiseFlags para descrição de adquirente parcelada."
required_fields: [rawDescription, normalizedDescription, direction, amountCents, date, documentType, noiseFlags, evidenceRaw]
forbidden: [invent_counterparty, merge_entries, drop_entries, change_amountCents, change_date_without_parse_evidence]
```

## Justificativa
Seed de normalização L2 para runner futuro: foca invariantes contábeis antes da classificação, sem depender do core do grafo.
