---
case_id: "export-0012"
module: "export"
outcome: "report_exported_monthly"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0012 — PDF magic bytes %PDF- nos primeiros 4 bytes + EOF marker

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present (DRE completo 31 linhas)
- analysis.narrativeCards: 3
- analysis.actionPlan: 9 actions
- request: GET /analysis/{id}/export/monthly

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_first_4_bytes_ascii: "%PDF"
expected_last_6_bytes_includes: "%%EOF"
expected_content_length_min: 2048
```

## Justificativa
PDF estrutura mínima: header `%PDF-` + trailer `%%EOF`. Buffer drenado deve abrir em qualquer leitor PDF (Acrobat, Chrome built-in, Preview).

## Tags
magic-bytes, pdf-structure, binary-validation
