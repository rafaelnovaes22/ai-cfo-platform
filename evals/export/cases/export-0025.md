---
case_id: "export-0025"
module: "export"
outcome: "report_exported_partners"
source_mode: "edge"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0025 — Partners lucro negativo → distribuição R$ 0 + disclaimer "prejuízo absorvido"

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: -30000_00 }
- tenant.productConfig: null  # v1 default N=2
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_distribution_per_partner_cents: 0
expected_disclaimer_includes: "prejuízo a ser absorvido pela empresa"
expected_disclaimer_fiscal_present: true
```

## Justificativa
§5.3 + §1.3 exemplo 3: lucroLiquido ≤ 0 → distribuição R$ 0 + disclaimer "Não há lucro para distribuir / prejuízo absorvido". Outcome conta.

## Tags
partners, lucro-negativo, disclaimer, prejuizo
