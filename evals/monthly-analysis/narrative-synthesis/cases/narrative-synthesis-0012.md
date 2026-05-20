---
case_id: "narrative-synthesis-0012"
module: "monthly-analysis/narrative-synthesis"
outcome: "cashflow_synthesis"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-20"
---

# Case narrative-synthesis-0012 — E-commerce com chargebacks

## Input

```yaml
dre: "chargebacks=420000; receitaBruta=14000000; margemLiquida=11; anomaly=CHARGEBACK_SPIKE"
anomalies: []
marginDiagnosis: "see dre metrics"
cashflowRisk: "derived from input when present"
tenant_context: { industrySegment: "PME", toneOfVoice: "direto", taxRegime: "simplesNacional" }
```

## Ground truth (rubrica)

```yaml
schema_must_pass: true
exact_cards: 3
required_card_types: [critical_gap, attention, healthy]
required_fields_per_card: [type, title, narrative, evidenceRefs, severity]
judge_criteria:
  factualidade: "Toda afirmação quantitativa deve bater com o DRE/anomalias de input."
  sintese_executiva: "CEO de PME entende em até 30 segundos, sem jargão contábil excessivo."
  equilibrio: "Citar chargebacks e impacto em caixa; incluir evidência."
forbidden: [invent_metric, omit_evidenceRefs, overstate_fraud, generic_advice_without_numbers]
```

## Justificativa
Caso cobre síntese narrativa do monthly-analysis e força exatamente três cards com evidência rastreável.
