---
case_id: "export-0029"
module: "export"
outcome: "report_exported_partners"
source_mode: "edge"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0029 — Partners sharePercentage inválido (soma ≠ 100) → fallback igual + warning

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 100000_00 }
- tenant.productConfig.partners: [
    { name: "A", sharePercentage: 40 },
    { name: "B", sharePercentage: 30 }
  ]   # soma = 70, inválido
- request: GET /analysis/{id}/export/partners

## Ground truth (v2)
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_fallback: "distribuicao_igual"
expected_distribution_per_partner_cents: 50000_00  # 50/50 fallback
expected_log_warning_event: "partners.sharePercentage.invalid_sum"
expected_disclaimer_present: true
```

## Justificativa
§1.3 exemplo negativo 2 + §5.3 v2: soma ≠ 100 → fallback distribuição igual + log warning. Outcome conta com proviso.

## Tags
sharePercentage-invalido, fallback, warning, v2-todo
