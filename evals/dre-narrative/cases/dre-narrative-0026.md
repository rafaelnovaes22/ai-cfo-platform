---
case_id: "dre-narrative-0026"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0026 — Margem borderline 4,99% (deve disparar critical_gap)

## Input
- DRE: margemLiquida=0.0499 (4,99% — abaixo do threshold §7); receitaLiquida=R$ 100.000,00; lucroLiquido=R$ 4.990,00 (vide dre-narrative-0011)
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
critical_gap_card:
  must_reference: ["margemLiquida"]
  must_treat_as_critical: true              # 4,99% < 5%
  must_NOT_round_up_to_5: true              # narrar NUNCA pode arredondar para mascarar
judge_criteria:
  clareza: "Mostra margem real (4,99%) com formato BR"
  acionabilidade: "Aponta '0,01 ponto abaixo do limite'; sugere alavanca"
  factualidade: "Margem exata, não arredondada para 5,0%"
forbidden_actions: ["arredondar para cima na narrativa"]
required_metrics_in_evidence: ["margemLiquida"]
```

## Justificativa
Borderline crítico. Testa que LLM respeita o número exato do DRE e não suaviza (4,99% → "≈5%"). Importante para SHADOW: humano detecta se houve auto-correção da narrativa que vira mentira branca.
