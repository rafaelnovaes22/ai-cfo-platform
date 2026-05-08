---
module_key: "alerts"
module_name: "Alerts — Alertas Proativos"
wave: 2
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#41, #56"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Alerts — Alertas Proativos

> Motor de alertas: ruptura de caixa próxima, queda de margem, burn elevado, metas não atingidas. Notificações in-app + email + (futuro) WhatsApp.

## Outcomes principais

- `alert_triggered`: condição detectada, notificação enviada
- `alert_acknowledged`: cliente viu/marcou
- `goal_missed`: meta financeira não atingida no período

## Features cobertas (das 60 do Aicfo)

Identificadores: #41, #56

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module alerts` quando este módulo entrar em desenvolvimento (Onda 2).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
