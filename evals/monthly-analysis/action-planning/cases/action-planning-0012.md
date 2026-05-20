---
case_id: "action-planning-0012"
module: "monthly-analysis/action-planning"
outcome: "cash_recovery_plan"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-20"
---

# Case action-planning-0012 — Lucro positivo com caixa negativo

## Input

```yaml
dre_and_diagnostics: "lucroLiquido=540000; FCO=-910000; DSO=67"
narrativeCards:
  - type: critical_gap
    evidenceRefs: ["dre_or_anomaly_metric"]
  - type: attention
    evidenceRefs: ["dre_or_anomaly_metric"]
  - type: healthy
    evidenceRefs: ["dre_or_anomaly_metric"]
tenant_context: { industrySegment: "PME", constraints: ["baixo esforço primeiro", "sem customização por tenant"] }
```

## Ground truth (schema + rubrica)

```yaml
schema_must_pass: true
min_actions_per_horizon: { short: 3, medium: 1, long: 1 }
required_fields_per_action: [horizon, title, description, effortLevel, riskLevel, impactCents, confidence, evidenceRefs, doneWhen]
judge_criteria:
  acionabilidade: "Cada ação tem verbo, dono implícito e doneWhen verificável."
  evidencia: "Cada ação cita evidenceRefs presentes no input."
  impacto_plausivel: "Plano deve focar ciclo financeiro e recebíveis."
forbidden: [empty_doneWhen, empty_evidenceRefs, irreversible_action_without_review, hallucinated_metric]
```

## Justificativa
Seed de action-planning para validar planos por horizonte e rastreabilidade de evidências antes do runner SHADOW.
