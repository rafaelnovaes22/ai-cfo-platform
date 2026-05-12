---
case_id: "dre-narrative-0028"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case dre-narrative-0028 — Re-geração idempotente (mesmo input, cards similares)

## Input
- DRE: idêntico ao dre-narrative-0001 (PME varejo saudável)
- Execução: roda o narrator 5x consecutivamente, temperature=0
- Tenant: industrySegment=varejo, taxRegime=lucroPresumido, toneOfVoice=formal

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
across_5_runs:
  card_types_must_be_identical: true                       # sempre [critical_gap, attention, healthy]
  evidence_metrics_must_be_identical_set: true             # mesmas métricas-chave
  body_text_variance_max: 0.05                             # < 5% diff por aproximação string
  no_run_may_omit_a_card_type: true
persistence_check:
  deleteMany_then_createMany_in_single_transaction: true   # spec §3
  langfuseTraceId_must_change_between_runs: true           # cada run = trace novo
judge_criteria:
  clareza: "Estável entre runs"
  acionabilidade: "Mesma direção entre runs"
  factualidade: "Mesmas métricas citadas"
```

## Justificativa
Spec §1.2 limite mínimo: "Variância em 5 reruns (temperature=0): < 5% diff de strings críticos". Testa idempotência narrativa + idempotência transacional (delete+create em tx Prisma única). Vital para confiança do cliente em "fechar o mês".
