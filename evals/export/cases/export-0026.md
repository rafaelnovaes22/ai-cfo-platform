---
case_id: "export-0026"
module: "export"
outcome: "report_exported_partners"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case export-0026 — Partners status=ready (SHADOW) bloqueia → 422

## Input (estado da análise)
- analysis.status: "ready"
- analysis.mode: "shadow"
- analysis.dreJson: present
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 422
expected_content_type: "application/json"
expected_error: "ANALYSIS_NOT_EXPORTABLE"
expected_reason_includes: "status=ready"
```

## Justificativa
§1.3 exemplo negativo 1 + C4: SHADOW nunca exporta — fix Onda A (2e44531) garante gate mecânico em todos os sabores.

## Tags
status-gate, shadow, partners, c4
