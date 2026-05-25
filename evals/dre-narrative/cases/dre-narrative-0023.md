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
  must_propose_action: "ex: 'renegocie com os 3 maiores fornecedores em 30 dias' ou 'teste mix de produtos com maior margem'"
judge_criteria:
  clareza: "Linguagem de varejo: explica CMV como 'o que foi pago aos fornecedores' e Margem Bruta como 'o que sobrou após pagar os fornecedores'; sem jargão de SaaS"
  acionabilidade: "Sugere alavanca concreta com prazo usando verbo permitido (Renegocie/Teste/Reduza): fornecedor, mix ou preço; com alvo numérico ou prazo"
  factualidade: "Cita CMV=R$ 65.000 e margemBruta=35% nos cards; sem benchmarks externos inventados"
required_metrics_in_evidence: ["cmv", "margemBruta"]
forbidden_terms: ["working capital", "stakeholder"]
```

## Justificativa
Regra §7 "CMV > 60% RB" para varejo. Testa que narrador conhece o setor (varejo = sensível a CMV) e propõe alavanca certa (fornecedor/mix), não jargão de SaaS (CAC, churn).
