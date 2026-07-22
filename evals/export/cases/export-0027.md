---
case_id: "export-0027"
module: "export"
outcome: "report_exported_partners"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0027 — Partners disclaimer fiscal obrigatório no PDF

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 50000_00 }
- tenant.productConfig: null
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_magic_bytes: "%PDF-"
expected_disclaimer_includes: "Valor estimado bruto; não considera impostos sobre distribuição, reserva legal"
expected_disclaimer_includes: "Consulte seu contador antes de saque"
```

## Justificativa
§5.3 literal: disclaimer fiscal obrigatório em TODO PDF partners. Compliance regulatório (risco crítico em §10).

## Tags
disclaimer-fiscal, compliance, regulatorio
