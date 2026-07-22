---
case_id: "export-0009"
module: "export"
outcome: "report_exported_monthly"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case export-0009 — Double-click do botão (2× em paralelo) é idempotente

## Input (estado da análise)
- analysis.status: "delivered"
- analysis.dreJson: present
- analysis.referenceMonth: "2026-04"
- requests: 2× GET /analysis/{id}/export/monthly em Promise.all paralelo

## Ground truth
```yaml
expected_http_code_both: 200
expected_content_type_both: "application/pdf"
expected_magic_bytes_both: "%PDF-"
expected_size_delta_max_percent: 20   # variação aceitável (timestamp footer)
expected_no_side_effect: true         # nenhuma persistência alterada
```

## Justificativa
§7.2: renderização determinística — duas chamadas retornam PDFs equivalentes (variação só em timestamp). Sem race, sem side-effect persistido.

## Tags
idempotent, concurrency, double-click
