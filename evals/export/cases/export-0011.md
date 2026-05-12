---
case_id: "export-0011"
module: "export"
outcome: "report_exported_monthly"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0011 — Filename injection via referenceMonth é sanitizada

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.referenceMonth: "../../etc/passwd"   # injection tentando escapar do path
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_filename_regex: "^aicfo-invalid-monthly\\.pdf$"
expected_content_disposition_no_newline: true
expected_content_disposition_no_carriage_return: true
```

## Justificativa
Fix Onda C1 (commit f62d508): referenceMonth fora do regex `^\d{4}-\d{2}$` é substituído por "invalid" — defesa contra response-splitting e path traversal em headers.

## Tags
filename-injection, security, sanitization, c1-fix
