---
case_id: "export-0024"
module: "export"
outcome: "report_exported_partners"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0024 — Partners com 4 sócios (v2) → 25/25/25/25

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 200000_00 }
- tenant.productConfig.partners: [{name:"A"},{name:"B"},{name:"C"},{name:"D"}]
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_distribution_count: 4
expected_distribution_per_partner_cents: 50000_00   # R$ 50.000 cada
expected_distribution_percent_each: 25
expected_disclaimer_present: true
```

## Justificativa
§5.3 v2 + §1.3 exemplo 2: 4 sócios cadastrados → distribuição igual 25%. (v1 ainda usa N=2 mock — se backend ainda em v1, este case fica documentação até implementação.)

## Tags
partners, 4-socios, distribuicao-igual, v2-todo
