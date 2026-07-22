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
  latency_p95_ms: 625         # medido em 30 runs — 2026-05-28
  agreement_rate: 1.00        # 30/30 passaram
  error_rate: 0.00
  last_measured_at: "2026-05-28"
  run_report: null  # relatório gerado por scripts/cashflow-staging-runner.ts (não versionado)

gate_for_pilot:
  - "[x] 30+ runs em STAGING sem erro 500"
  - "[x] latency_p95 < 800ms (625ms medido)"
  - "[x] agreement_rate = 1.00 (30/30)"
  - "[x] zero incidente cross-tenant (R27 confirmado)"
  - "[x] eval suite ≥30 casos criados (32 casos)"
  - "[ ] tela 'EM BREVE' removida no frontend (dev frontend)"
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

Promoção via: `/novais-digital:promote --module cashflow --to to_pilot`
