---
module_key: "kpis"
module_name: "KPIs — Métricas Automáticas"
wave: 2
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#24, #25, #47"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# KPIs — Métricas Automáticas

> Calcula KPIs financeiros em tempo real: CAC, LTV, payback, margem (bruta/contribuição/operacional/líquida), burn rate, runway. Atualização contínua.

## Outcomes principais

- `kpis_calculated`: todos os KPIs current com tendência
- `kpi_alert`: KPI fora de threshold dispara alerta
- `kpi_history_persisted`: snapshot mensal pra benchmarking interno

## Features cobertas (das 60 do Aicfo)

Identificadores: #24, #25, #47

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module kpis` quando este módulo entrar em desenvolvimento (Onda 2).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
