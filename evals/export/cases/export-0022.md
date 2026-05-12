---
case_id: "export-0022"
module: "export"
outcome: "report_exported_partners"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0022 — Partners com 1 sócio (productConfig.partners[].length=1) → 100%

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 100000_00 }
- tenant.productConfig.partners: [{ name: "Sócio 1" }]  # v2 (1 sócio)
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_filename_regex: "^aicfo-\\d{4}-\\d{2}-partners\\.pdf$"
expected_distribution_count: 1
expected_distribution_percent_each: 100
expected_disclaimer_present: true
```

## Justificativa
§5.3 v1: distribuição igual entre N sócios. N=1 → 100% para o único sócio. (v1 default usa N=2 — se factory v1, esperar 50/50; case documenta v2.)

## Tags
partners, 1-socio, distribuicao-100
