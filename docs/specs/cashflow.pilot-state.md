---
module_id: "cashflow"
spec_version: "0.1.0"
spec_path: "docs/specs/cashflow.md"
estado_atual: "STAGING"
responsavel: "Rafael Novaes"
constitution_version: "0.3.0"
created_at: "2026-05-28"
last_updated: "2026-05-28"

transitions:
  - from: "DRAFT"
    to: "STAGING"
    at: "2026-05-28"
    trigger: "spec + plan + tasks aprovados + backend implementado + 329 testes passando"
    approved_by: "Rafael Novaes"

pilot_start_date: null
pilot_end_date: null
pilot_tenant_count: 0
pilot_acceptance_threshold: 1.00

staging_metrics:
  latency_p95_ms: null        # preencher após 30 runs em staging
  agreement_rate: null
  error_rate: null
  last_measured_at: null

gate_for_pilot:
  - "[ ] 30+ runs em STAGING sem erro 500"
  - "[ ] latency_p95 < 800ms (medido via Pino logs)"
  - "[ ] agreement_rate = 1.00 (leitura determinística)"
  - "[ ] zero incidente cross-tenant"
  - "[ ] eval suite ≥30 casos passando"
---

# Pilot State — `cashflow`

## Histórico de transições

| De | Para | Data | Trigger | Aprovado por |
|---|---|---|---|---|
| DRAFT | STAGING | 2026-05-28 | Spec + plan + backend MVP implementado + 329 testes verdes | Rafael Novaes |

## Próxima promoção: STAGING → PILOT

Critérios (todos obrigatórios):
- [ ] 30+ runs em STAGING com dados reais sem erro 500
- [ ] `latency_p95 < 800ms` validado via Pino logs
- [ ] `agreement_rate = 1.00` (módulo determinístico — qualquer divergência é bug)
- [ ] Zero incidente de cross-tenant leakage
- [ ] Eval suite com ≥30 casos passando (`npm run eval -- --module cashflow`)
- [ ] Tela "EM BREVE" removida no frontend

Promoção via: `/acme:promote --module cashflow --to to_pilot`
