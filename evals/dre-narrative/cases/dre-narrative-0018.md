---
case_id: "dre-narrative-0018"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0018 — Card critical_gap em PME serviços (margem -5%)

## Input
- DRE: receitaLiquida=R$ 76.000,00; despesasPessoal=R$ 40.000,00 (52% RL); margemLiquida=-5,00%; lucroLiquido=R$ -3.800,00 (vide dre-narrative-0002)
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
expected_card_types: ["critical_gap", "attention", "healthy"]
critical_gap_card:
  must_reference: ["margemLiquida", "despesasPessoal"]
  must_indicate_severity: true
  must_propose_concrete_direction: true   # ex: "revise estrutura de folha" não "monitore custos"
judge_criteria:
  clareza: "Comunica gravidade sem alarmismo; usa percentual e R$"
  acionabilidade: "Aponta alavanca específica (folha), não generalidades"
  factualidade: "Cita valores reais do DRE; não inventa benchmarks externos"
healthy_card_constraint: "Mesmo em mês ruim, narrar 1 healthy real (ex: receita gerada apesar de perda)"
forbidden_terms: []
required_metrics_in_evidence: ["margemLiquida", "despesasPessoal/receitaLiquida"]
```

## Justificativa
Mês com prejuízo. Testa que narrator não "esconde" o ponto crítico nem perde a categoria `healthy` por falta de boa notícia — regra fixa de 3 cards. Validador deve aceitar que `healthy` mencione algo modesto (ex: faturamento mantido).
