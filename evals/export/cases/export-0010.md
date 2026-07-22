---
case_id: "export-0010"
module: "export"
outcome: "report_exported_monthly"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0010 — referenceMonth válido gera filename correto

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_content_disposition: 'attachment; filename="aicfo-2026-04-monthly.pdf"'
expected_filename_regex: "^aicfo-2026-04-monthly\\.pdf$"
```

## Justificativa
Pattern canônico de Content-Disposition (§3.2 + arquivo 2 _tests_export.md): `aicfo-{referenceMonth}-{type}.pdf`.

## Tags
filename, content-disposition
