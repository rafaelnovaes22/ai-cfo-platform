---
case_id: "export-0002"
module: "export"
outcome: "report_exported_monthly"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0002 — Status approved também exporta

## Input (estado da análise)
- analysis.status: "approved"
- analysis.mode: "autonomous"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-03"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_filename_regex: "^aicfo-2026-03-monthly\\.pdf$"
expected_content_length_min: 1024
```

## Justificativa
EXPORTABLE_STATUS inclui "approved" — análise editada e aprovada pelo cliente continua exportável (commit 2e44531).

## Tags
status-approved, autonomous-mode
