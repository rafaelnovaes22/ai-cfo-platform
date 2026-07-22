---
case_id: "export-0015"
module: "export"
outcome: "report_exported_investors"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0015 — Investors sem actions (action-plan ainda não rodou)

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.narrativeCards: 3
- analysis.actionPlan: null (worker action-plan ainda não rodou)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_totalImpactCents: 0
expected_shortHorizonImpactCents: 0
expected_plano_acao_section: "n/a"
```

## Justificativa
§5.2 + §1.2 exemplo positivo 3: sem actions, KPIs derivados retornam 0 e seção Plano de Ação indica n/a. Outcome conta — falha está no action-plan, não no export.

## Tags
no-actions, kpis-zero, graceful-degradation
