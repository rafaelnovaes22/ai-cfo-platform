---
case_id: "export-0020"
module: "export"
outcome: "report_exported_investors"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0020 — Investors com cardTypeCounts assimétrico (3 critical, 0 healthy)

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: -50000_00 }
- analysis.narrativeCards: 3 cards { critical_gap, critical_gap, critical_gap }
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_cardTypeCounts:
  critical_gap: 3
  attention: 0
  healthy: 0
expected_magic_bytes: "%PDF-"
```

## Justificativa
§5.2: KPI `cardTypeCounts` reflete contagem real, não força distribuição uniforme. Cenário "tudo em fogo" deve aparecer literalmente para o board.

## Tags
cardTypeCounts, assimetrico, board-signal
