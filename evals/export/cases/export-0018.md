---
case_id: "export-0018"
module: "export"
outcome: "report_exported_investors"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0018 — Investors filename pattern por sabor

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-03"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_disposition: 'attachment; filename="aicfo-2026-03-investors.pdf"'
expected_filename_regex: "^aicfo-\\d{4}-\\d{2}-investors\\.pdf$"
```

## Justificativa
Pattern de filename inclui o sabor explicitamente — cliente vê origem do relatório imediatamente.

## Tags
filename, content-disposition, investors
