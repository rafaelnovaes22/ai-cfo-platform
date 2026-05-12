---
case_id: "action-plan-0022"
module: "action-plan"
outcome: "plan_generated"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case action-plan-0022 — Itens duplicados entre horizontes (mesma ação em short e medium)

## Input
- DRE: válido (saudável)
- LLM behavior: retorna 5 short + 2 medium + 1 long, mas "Renegociar telefonia" aparece como item short ("renegociar contrato em 30d") E medium ("renegociar contrato em 90d") com wording levemente diferente
- Tenant: padrão

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true  # schema não detecta duplicação semântica
judge_criteria:
  duplicacao_semantica: "Judge flag se ações em horizontes diferentes têm intent semanticamente igual (≥0.85 cossine de title/description)"
  acionabilidade: "Cada horizonte deve trazer ação distinta — duplicação inflaciona impactCents"
expected_judge_score_acionabilidade: "<=3"
```

## Justificativa
Risco §11 da spec ("itens repetidos entre horizontes"). Sintoma: LLM com poucos sinais reaproveita ação. Judge precisa de rubrica explícita pois schema não detecta.
