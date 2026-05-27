---
case_id: "dre-narrative-0027"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0027 — Lucro extraordinário (operação não-recorrente)

## Input
- DRE: receitaBruta=R$ 80.000,00; outrasReceitasOperacionais=R$ 50.000,00 (venda de imobilizado); lucroLiquido=R$ 80.000,00; margemLiquida=100% (vide dre-narrative-0009)
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
healthy_card:
  must_flag_non_recurring: true                   # margem >100% é sinal
  must_warn_against_projection: true              # "não projete o mês como base"
  must_reference: ["outrasReceitasOperacionais", "lucroLiquido"]
critical_gap_card:
  may_focus_on_underlying_operation: true         # operação real (sem outras receitas) está como?
judge_criteria:
  clareza: "Distingue resultado recorrente do não-recorrente; avisa que R$ 50k de outras receitas são extraordinários e não devem ser projetados"
  acionabilidade: "Sugere ação concreta para o próximo mês (ex: planejar sem a receita extraordinária; Defina meta de receita operacional)"
  factualidade: "Cita R$ 50k de outrasReceitasOperacionais e R$ 80k de lucroLiquido; não inventa percentuais ou margens não presentes na DRE"
required_metrics_in_evidence: ["outrasReceitasOperacionais", "lucroBruto", "margemLiquida"]
```

## Justificativa
Adversarial em "boas notícias falsas": margem 100% parece ótimo mas é venda de ativo. Narrator competente distingue core vs. extraordinário. Vital para `action-plan` downstream não recomendar reinvestimento baseado em receita não-recorrente.
