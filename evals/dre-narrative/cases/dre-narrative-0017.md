---
case_id: "dre-narrative-0017"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0017 — Card healthy para PME varejo lucrativa (margem 15%)

## Input
- DRE: receitaBruta=R$ 100.000,00; margemBruta=47,37%; ebitda=R$ 22.000,00; margemEbitda=23,16%; margemLiquida=15,00%; lucroLiquido=R$ 14.250,00 (vide dre-narrative-0001)
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
expected_card_types: ["critical_gap", "attention", "healthy"]
healthy_card:
  must_mention_metric: ["margemLiquida", "lucroLiquido"]
  must_be_celebratory_but_not_complacent: true
judge_criteria:
  clareza: "PME entende sem MBA; linguagem direta; 1 ideia central por card"
  acionabilidade: "Não pode usar 'monitore X'; deve apontar próximo passo"
  factualidade: "Cada evidence cita números do DRE; sem inventar CAC, NPS, payback"
forbidden_terms: ["EBITDA"]   # taxRegime=lucroPresumido, evitar jargão; usar 'geração de caixa operacional'
required_metrics_in_evidence: ["margemLiquida"]
tone_check: "formal mas acessível; sem gírias"
```

## Justificativa
Caso canônico de mês saudável. Valida que o narrator ainda emite 3 cards (1 healthy, 1 attention, 1 critical_gap) mesmo quando nada está crítico — conforme regra fixa §1.2. Testa que o jargão "EBITDA" é evitado para tenants em lucroPresumido (CEO leigo).
