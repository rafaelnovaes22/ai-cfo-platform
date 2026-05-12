---
case_id: "classification-0032"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0032 — Adversarial: descrição longa + unicode emoji + idioma misto

## Input (LedgerEntry)
- `description`: "PAGAMENTO 🚀 SERVICE FEE — invoice #4521 — cliente internacional ACME GMBH zahlung für beratung — consultoria estratégica trimestral payment for Q2 services rendered including but not limited to advisory sessions strategy workshops executive coaching engagements with senior leadership team across multiple business units focused on digital transformation initiatives data analytics enablement and operating model redesign efforts spanning april through june 2026 fiscal quarter end reconciliation 💼💰"
- `amountCents`: 1850000
- `direction`: "debit"
- `date`: "2026-04-28"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "despesas_juridicas"
expected_confidence_min: 0.45
expected_confidence_max: 0.69
acceptable_alternatives: ["custo_servicos", "despesas_administrativas", "outras_despesas"]
```

## Justificativa
Descrição >500 chars, unicode (emoji), trilíngue (PT/EN/DE) — adversarial de robustez do tokenizer/parser. Conteúdo semântico aponta para consultoria estratégica (`despesas_juridicas` agrupa consultores) ou `custo_servicos` se sub-contratado para projeto. Modelo deve sinalizar incerteza pela densidade de tokens irrelevantes.

## Tags
adversarial, long-text, unicode-emoji, multilingual
