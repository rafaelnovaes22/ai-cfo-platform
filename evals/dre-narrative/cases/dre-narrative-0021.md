---
case_id: "dre-narrative-0021"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0021 — naoClassificado > 10% (warning não-bloqueante)

## Input
- DRE: receitaBruta=R$ 50.000,00; cmv=R$ 20.000,00; naoClassificado=R$ 8.000,00 (16% do movimentado); margemLiquida=60,00% (vide dre-narrative-0006)
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
attention_card:
  should_mention_naoClassificado: true    # narrar avisa, frontend exibe banner
  must_NOT_block_delivery: true
judge_criteria:
  clareza: "Explica impacto: 'até classificar, números podem mudar'"
  acionabilidade: "Pede ação ao usuário: 'classifique os 20 lançamentos pendentes'"
  factualidade: "Cita valor R$ 8.000 e percentual ~16%"
required_metrics_in_evidence: ["naoClassificado"]
```

## Justificativa
Edge §5: `naoClassificado > 0` → frontend exibe banner; narrator deve mencionar mas não bloquear nem alarmar. Testa que LLM segue a hierarquia: entrega 3 cards, sinaliza pendência, propõe ação ao usuário.
