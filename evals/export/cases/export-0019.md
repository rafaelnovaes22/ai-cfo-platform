---
case_id: "export-0019"
module: "export"
outcome: "report_exported_investors"
source_mode: "adversarial"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0019 — Tenant name com caracteres especiais (XSS/control chars) é escapado

## Input (estado da análise)
- tenant.name: `Novais Digital '><script>alert(1)</script> & Cia LTDA`
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/investors

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_no_raw_html_in_payload: true
expected_no_control_chars_in_headers: true
```

## Justificativa
§7.5 + Onda C1: pdfkit escapa texto. Defesa-em-profundidade: nenhum byte de controle (`\n`, `\r`) vaza para Content-Disposition. Renderização não quebra.

## Tags
adversarial, xss, escape, security
