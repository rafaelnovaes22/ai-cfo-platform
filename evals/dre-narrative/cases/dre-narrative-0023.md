---
case_id: "dre-narrative-0023"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0023 — Card attention para CMV > 60% (varejo)

## Input
- DRE: receitaBruta=R$ 100.000,00; cmv=R$ 65.000,00; cmv/RB=65%; margemBruta=35%; margemLiquida=30% (vide dre-narrative-0008)
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
attention_card:
  must_reference: ["cmv", "margemBruta"]
  must_compare_to_threshold: "~60% varejo"   # narrador pode citar regra de bolso do setor
  must_propose_action: "ex: 'renegocie 3 maiores fornecedores' ou 'revise mix de produtos'"
judge_criteria:
  clareza: "Linguagem de varejo (margem bruta = 'o que sobra após pagar fornecedor')"
  acionabilidade: "Sugere alavanca: fornecedor, mix, preço"
  factualidade: "Cita R$ 65k de CMV e margem bruta 35%"
required_metrics_in_evidence: ["cmv/receitaBruta", "margemBruta"]
forbidden_terms: ["working capital", "stakeholder"]
```

## Justificativa
Regra §7 "CMV > 60% RB" para varejo. Testa que narrador conhece o setor (varejo = sensível a CMV) e propõe alavanca certa (fornecedor/mix), não jargão de SaaS (CAC, churn).
