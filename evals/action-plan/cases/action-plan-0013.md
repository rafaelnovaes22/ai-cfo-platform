---
case_id: "action-plan-0013"
module: "action-plan"
outcome: "plan_generated"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case action-plan-0013 — Tom direto vs formal (mesmo DRE, tenant diferente)

## Input
- DRE: igual ao action-plan-0001
- NarrativeCards: idênticos
- Tenant A: industrySegment=varejo, toneOfVoice=direto ("você", "vai", curto)
- Tenant B: industrySegment=varejo, toneOfVoice=formal ("sugerimos", "recomenda-se")

## Ground truth (schema + rubrica)
```yaml
schema_must_pass: true
min_actions_per_horizon: {short: 3, medium: 1, long: 1}

judge_criteria:
  tom_aderente: "Tenant A: títulos/descrições com voz ativa e 2ª pessoa; Tenant B: voz passiva/coletiva. Judge mede aderência ao toneOfVoice configurado"
  acionabilidade: "Idêntica nos dois — só o tom muda, conteúdo igual"
```

## Justificativa
Validação C8 — toggle de tenant (toneOfVoice) deve trocar redação sem mudar substância. Se LLM ignora toneOfVoice, judge flag baixo em "tom_aderente" e abre hardcode-check (não pode ter prompt fixo de tom).
