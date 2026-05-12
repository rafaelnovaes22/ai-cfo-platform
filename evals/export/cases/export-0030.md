---
case_id: "export-0030"
module: "export"
outcome: "report_exported_partners"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0030 — Partners blob não pode ser zero-sized + auditoria logger

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: { lucroLiquido: 75000_00 }
- analysis.referenceMonth: "2026-04"
- request: GET /analysis/{id}/export/partners

## Ground truth
```yaml
expected_http_code: 200
expected_content_type: "application/pdf"
expected_content_length_min: 1024
expected_first_4_bytes_ascii: "%PDF"
expected_last_6_bytes_includes: "%%EOF"
expected_logger_info_event: "export.report.generated"
expected_logger_fields_present: [tenantId, analysisId, type, fileSize, latency_ms, outcomeType, costBrl, sku]
expected_costBrl: 0
```

## Justificativa
§7.3 + §9 + Onda C1 (commit f62d508): payload > 1KB obrigatório; logger.info estruturado para auditoria (LGPD/cobrança). costBrl=0 (sem LLM runtime).

## Tags
zero-sized-guard, auditoria, c6-logger, c1-fix
