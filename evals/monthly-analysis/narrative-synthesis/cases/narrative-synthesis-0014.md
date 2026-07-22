---
case_id: "narrative-synthesis-0014"
module: "monthly-analysis/narrative-synthesis"
outcome: "contradiction_handling"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-20"
---

# Case narrative-synthesis-0014 — Dados contraditórios entre DRE e anomalias

## Input

```yaml
dre: "dre.margemLiquida=18; anomalies=[NEGATIVE_CASHFLOW severe, OVERDUE_TAXES]"
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
  equilibrio: "Cards devem reconciliar contradição e sinalizar revisão, não escolher um dado sem explicar."
forbidden: [invent_metric, omit_evidenceRefs, overstate_fraud, generic_advice_without_numbers]
```

## Justificativa
Caso cobre síntese narrativa do monthly-analysis e força exatamente três cards com evidência rastreável.
