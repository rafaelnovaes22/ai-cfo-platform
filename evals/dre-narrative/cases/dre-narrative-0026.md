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
- DRE: margemLiquida=4,99%; receitaLiquida=R$ 100.000,00; lucroLiquido=R$ 4.990,00 (vide dre-narrative-0011)
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
  clareza: "Mostra margem real de 4,99% sem arredondar para 5%; evidencia que está abaixo do limite"
  acionabilidade: "Sugere ação concreta para melhorar margem (Renegocie/Corte/Reduza) com alvo numérico e prazo"
  factualidade: "Margem citada como 4,99% (exata); lucroLiquido=R$ 4.990 correto"
forbidden_actions: ["arredondar para cima na narrativa"]
required_metrics_in_evidence: ["margemLiquida"]
```

## Justificativa
Borderline crítico. Testa que LLM respeita o número exato do DRE e não suaviza (4,99% → "≈5%"). Importante para SHADOW: humano detecta se houve auto-correção da narrativa que vira mentira branca.
