---
case_id: "classification-0037"
module: "classification"
outcome: "classification_confidence_low"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-06-11"
---

# Case classification-0037 — Pró-labore com direção confiável contraditória (salvaguarda → revisão)

## Input (LedgerEntry)
- `description`: "Pró-labore Cid Moreira"
- `amountCents`: 900000
- `direction`: "credit"
- `directionInferred`: false
- `date`: "2026-04-05"
- `tenant_context`: { industrySegment: "geral", taxRegime: "simples_nacional" }

## Ground truth
```yaml
expected_category: "prolabore"
expected_confidence_min: 0.80
acceptable_alternatives: []
expected_correction_source: "needs_review"
```

## Justificativa
Regressão do extrato real CID & CID (2026-06-11): pró-labore (natureza débito) veio com direção `credit` marcada como confiável (não-inferida). A categoria está correta (`prolabore`), mas a natureza contradiz a direção confiável com alta confiança. A salvaguarda (`needsDirectionReview`) NÃO sobrescreve a direção confiável, mas marca `correctionSource="needs_review"` em vez de gravar silenciosamente uma retirada de sócio como receita.

## Tags
adversarial, direcao-contraditoria, salvaguarda, regressao-cid
