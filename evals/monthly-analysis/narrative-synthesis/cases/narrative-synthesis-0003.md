---
case_id: "narrative-synthesis-0003"
module: "monthly-analysis/narrative-synthesis"
outcome: "margin_synthesis"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-20"
---

# Case narrative-synthesis-0003 — Indústria com CMV pressionando margem

## Input

```yaml
dre: "margemBruta=22; margemBrutaAnterior=31; cmv=6400000; receitaLiquida=8200000"
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
  equilibrio: "Card attention sobre CMV; não culpar impostos sem evidência."
forbidden: [invent_metric, omit_evidenceRefs, overstate_fraud, generic_advice_without_numbers]
```

## Justificativa
Caso cobre síntese narrativa do monthly-analysis e força exatamente três cards com evidência rastreável.
