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
  must_reference: ["despesasFinanceiras", "lucroOperacional"]
  must_propose_action: "ex: 'avalie refinanciar a dívida mais cara' ou 'projete impacto de Selic'"
judge_criteria:
  clareza: "Indústria entende alavancagem; usar 'juros corroem 20% do operacional'"
  acionabilidade: "Aponta dívida específica ou pergunta ao usuário"
  factualidade: "20% derivado de 4k/20k"
required_metrics_in_evidence: ["despesasFinanceiras/lucroOperacional"]
permitted_terms: ["EBITDA"]   # lucroReal, jargão aceito
```

## Justificativa
Regra §7 "Despesas financeiras > 15% lucro operacional". Indústria em lucroReal frequentemente alavancada. Testa que narrator sugere alavanca financeira (refi, prazo) e não corte operacional.
