---
case_id: "export-0023"
module: "export"
outcome: "report_exported_partners"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0023 — Partners default v1 (2 sócios 50/50)

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 100000_00 }
- tenant.productConfig: null   # v1 default — N=2
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_distribution_count: 2
expected_distribution_per_partner_cents: 50000_00   # R$ 50.000 cada
expected_distribution_percent_each: 50
expected_disclaimer_present: true
```

## Justificativa
§5.3 + §1.3 exemplo 1: v1 default N=2 → 50/50. Disclaimer fiscal obrigatório no PDF.

## Tags
partners, default-v1, 50-50
