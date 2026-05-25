---
case_id: "dre-narrative-0025"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0025 — Indústria com alavancagem financeira

## Input
- DRE: receitaBruta=R$ 100.000,00; lucroOperacional=R$ 20.000,00; despesasFinanceiras=R$ 4.000,00 (20% do lucroOperacional); margemLiquida=16% (vide dre-narrative-0014)
- Tenant: industrySegment=industria, taxRegime=lucroReal, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
attention_card:
  must_reference: ["despesasFinanceiras"]
  must_propose_action: "ex: 'renegocie a dívida mais cara nos próximos 30 dias' ou 'reduza exposição a crédito variável'"
judge_criteria:
  clareza: "Explica no body que as despesas financeiras consomem parcela relevante do lucro operacional; linguagem de indústria; sem jargão de SaaS"
  acionabilidade: "Aponta ação concreta sobre a dívida (Renegocie/Reduza exposição) com prazo explícito em dias"
  factualidade: "Cita despesasFinanceiras=R$ 4.000 em evidence; sem inventar valores não presentes na DRE"
required_metrics_in_evidence: ["despesasFinanceiras"]
permitted_terms: ["EBITDA"]   # lucroReal, jargão aceito
```

## Justificativa
Regra §7 "Despesas financeiras > 15% lucro operacional". Indústria em lucroReal frequentemente alavancada. Testa que narrator sugere alavanca financeira (refi, prazo) e não corte operacional.
