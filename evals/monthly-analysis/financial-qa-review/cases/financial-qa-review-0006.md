---
case_id: "financial-qa-review-0006"
module: "monthly-analysis/financial-qa-review"
outcome: "detect_overclaim"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-20"
---

# Case financial-qa-review-0006 — Suspeita de fraude afirmada como fraude

## Input

```yaml
monthly_analysis_state_summary: "anomaly=DUPLICATE_SUSPECT; card says fraude comprovada"
dre: { receitaBruta: 10000000, margemBruta: 47.37, margemLiquida: 15 }
narrativeCards: "provided by case summary"
actionPlan: "provided by case summary"
anomalies: "provided by case summary"
```

## Ground truth (QA esperado)

```yaml
expected: "publishable=false; issue severity=major/blocker; retryTargets=[narrative-synthesis]"
required_fields: [publishable, issues, retryTargets]
issue_required_fields: [severity, target, evidenceRef, message]
forbidden: [approve_blocker, silent_metric_mismatch, retry_unknown_agent, expose_unverified_accusation]
```

## Justificativa
Caso adversarial de QA financeiro: valida bloqueio antes de entrega e direciona retry condicional sem tocar no grafo.
