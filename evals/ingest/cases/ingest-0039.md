---
case_id: "ingest-0039"
module: "ingest"
outcome: "new_analysis_triggered"
source_mode: "adversarial"
priority: "P2"
created_at: "2026-05-12"
---

# Case ingest-0039 — XSS na description não impede criação da análise (sanitização downstream)

## Input
- `source`: manual
- `payload`: 50 entries via /ingest/manual, sendo 1 com description contendo `"<script>alert('xss')</script>"`. Primeiro upload do par
- `tenantId`: "tenant-test-039"
- `referenceMonth`: "2026-04"

## Ground truth (output esperado)
```json
{
  "analysisId": "<ulid-non-empty>",
  "entryCount": 50,
  "orphanCount": 0,
  "outcome": "completed",
  "side_effect": "monthlyAnalysis.create called once; description string persistida AS-IS (sanitização é responsabilidade do frontend)"
}
```

## Justificativa
Adversarial: backend não trata description como HTML — armazena string opaca. new_analysis_triggered ocorre normalmente. Frontend escapa ao renderizar.

## Tags
adversarial, xss-string, side-effect, no-html-trust
