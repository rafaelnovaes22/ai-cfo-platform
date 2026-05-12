---
case_id: "export-0028"
module: "export"
outcome: "report_exported_partners"
source_mode: "synthetic"
priority: "P2"
created_at: "2026-05-12"
---

# Case export-0028 — Partners productConfig.partners customizado com sharePercentage (v2)

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 100000_00 }
- tenant.productConfig.partners: [
    { name: "Fundador",  sharePercentage: 60 },
    { name: "Investidor", sharePercentage: 30 },
    { name: "CTO",        sharePercentage: 10 }
  ]
- request: GET /analysis/{id}/export/partners

## Ground truth (v2 — NÃO IMPLEMENTADO em v1)
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_distribution:
  - { name: "Fundador",   amount_cents: 60000_00 }
  - { name: "Investidor", amount_cents: 30000_00 }
  - { name: "CTO",        amount_cents: 10000_00 }
expected_disclaimer_present: true
v1_behavior_documented: "v1 ignora sharePercentage e usa distribuição igual N=2 → fallback documentado em §5.3"
```

## Justificativa
§5.3 v2 (Onda C — TODO): respeitar sharePercentage. v1 não implementa — case serve como contrato para implementação futura + smoke test após release.

## Tags
v2-todo, sharePercentage, productConfig, contrato-futuro
