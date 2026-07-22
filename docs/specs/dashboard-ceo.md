---
module_key: "dashboard-ceo"
module_name: "Dashboard CEO — Visão Executiva"
wave: 2
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#23, #58"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Dashboard CEO — Visão Executiva

> Versão simplificada e refinada do hub: KPIs principais, alertas, score, runway. Otimizado para CEO que olha em 30s e decide. Suporte à decisão estratégica.

## Outcomes principais

- `dashboard_loaded`: visão executiva renderizada
- `decision_supported`: cliente clica em ação recomendada (deeplink ao plano)

## Features cobertas (das 60 do Aicfo)

Identificadores: #23, #58

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module dashboard-ceo` quando este módulo entrar em desenvolvimento (Onda 2).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
