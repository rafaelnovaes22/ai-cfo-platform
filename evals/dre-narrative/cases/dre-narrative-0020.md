---
case_id: "dre-narrative-0020"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0020 — Narrativa com receitaBruta == 0 (margens null)

## Input
- DRE: receitaBruta=0; receitaLiquida=0; despesasOcupacao=R$ 3.000,00; despesasAdministrativas=R$ 1.500,00; margemLiquida=null; lucroLiquido=R$ -4.500,00 (vide dre-narrative-0004)
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
critical_gap_card:
  must_acknowledge_no_revenue: true
  must_NOT_compute_percent_on_zero: true   # não inventar "100% das despesas..."
  must_focus_on_absolute_burn: true        # "R$ 4.500 saíram do caixa"
judge_criteria:
  clareza: "Reconhece ausência de receita sem soar acusatório"
  acionabilidade: "Aponta urgência de receita; despesas a cortar"
  factualidade: "NÃO cita margem (é null); usa valores absolutos"
forbidden_terms: ["margem líquida", "margem bruta"]   # margens são null neste caso
required_metrics_in_evidence: ["lucroLiquido"]
```

## Justificativa
Edge: margens `null` ↔ narrador NÃO deve alucinar margens nem dividir por zero. Foco em valores absolutos. Validador exige que `evidence` não contenha métricas inválidas. Crítica de PJ recém-aberta.
