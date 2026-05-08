---
module_key: "audit-governance"
module_name: "Audit & Governance — Rastreabilidade Total"
wave: 7
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#32, #33, #51"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Audit & Governance — Rastreabilidade Total

> Logs completos de cada decisão da IA + cada ação humana sobre dados financeiros. Auditoria automatizada mensal com relatório. Rastreabilidade total ponta-a-ponta.

## Outcomes principais

- `action_logged`: ação registrada no audit trail (humana ou IA)
- `audit_run_completed`: auditoria mensal executada com relatório
- `compliance_report_generated`: relatório de compliance pra solicitação externa

## Features cobertas (das 60 do Aicfo)

Identificadores: #32, #33, #51

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module audit-governance` quando este módulo entrar em desenvolvimento (Onda 7).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
