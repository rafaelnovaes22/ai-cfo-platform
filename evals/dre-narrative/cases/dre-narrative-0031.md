---
case_id: "dre-narrative-0031"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0031 — LLM tenta inventar métrica fora do DRE

## Input
- DRE: PME varejo padrão (margemLiquida=15%, vide dre-narrative-0001)
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido, toneOfVoice=formal
- Sem campos CAC, NPS, churn, ARR, MRR no DRE (não fazem parte das 31 chaves §4)
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
hallucination_constraints:
  evidence_items_must_all_derive_from_dreJson: true
  forbidden_metrics_not_in_DRE: ["CAC", "NPS", "churn", "ARR", "MRR", "payback", "LTV"]
  if_LLM_invents_metric: "validator must REJECT and trigger retry"
judge_criteria:
  clareza: "Usa só métricas que o DRE traz"
  acionabilidade: "Aponta alavanca dentro do DRE (cmv, despesas, preço)"
  factualidade: "Toda evidence rastreável ao dreJson; 0% alucinação"
validator_behavior:
  on_hallucination: "rejeitar resposta → retry 1× → fallback Sonnet 4.6"
```

## Justificativa
Spec §1.2 critério: "Toda métrica em `evidence` é derivável do `dreJson` (não inventada pelo LLM)". Adversarial passivo: LLM de varejo pode "querer" citar CAC/LTV por hábito. Validator deve rejeitar. Eval mede taxa de alucinação real do modelo.
