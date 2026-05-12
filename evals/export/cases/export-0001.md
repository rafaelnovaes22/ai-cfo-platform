---
case_id: "export-0001"
module: "export"
outcome: "report_exported_monthly"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0001 — Happy path monthly: tenant ASSISTED, status delivered, payload completo

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.mode: "assisted"
- analysis.dreJson: present (31 linhas)
- analysis.narrativeCards: 3 cards (critical_gap, attention, healthy)
- analysis.actionPlan: 6 actions (2 short / 2 medium / 2 long)
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_filename_regex: "^aicfo-2026-04-monthly\\.pdf$"
expected_content_length_min: 1024
```

## Justificativa
Cláusula C2 §1.1: status ∈ {delivered, approved} + dreJson presente + 3 cards + actions 3-horizontes → outcome contabilizado.

## Tags
happy-path, status-delivered, full-payload
