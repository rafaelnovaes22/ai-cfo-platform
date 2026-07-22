---
case_id: "narrative-synthesis-0002"
module: "monthly-analysis/narrative-synthesis"
outcome: "risk_synthesis"
source_mode: "real"
priority: "P0"
created_at: "2026-05-20"
---

# Case narrative-synthesis-0002 — Serviços com receita caindo e caixa apertado

## Input

```yaml
dre: "receitaBruta=8200000; variacaoReceita=-18%; margemLiquida=4; runwayDias=21"
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
  equilibrio: "Critical gap deve priorizar queda de receita + runway; incluir evidência numérica."
forbidden: [invent_metric, omit_evidenceRefs, overstate_fraud, generic_advice_without_numbers]
```

## Justificativa
Caso cobre síntese narrativa do monthly-analysis e força exatamente três cards com evidência rastreável.
