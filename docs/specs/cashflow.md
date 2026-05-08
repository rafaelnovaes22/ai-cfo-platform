---
module_key: "cashflow"
module_name: "Cashflow — Fluxo de Caixa em Tempo Real + Projeção"
wave: 2
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#2, #3, #57"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Cashflow — Fluxo de Caixa em Tempo Real + Projeção

> Visão diária do fluxo de caixa (saldo, entradas, saídas) atualizada em tempo real conforme integrações. Projeção 7/30/90 dias com cenários. Visualização de burn rate e runway.

## Outcomes principais

- `cashflow_realtime_loaded`: dashboard com saldo current + delta diário
- `projection_generated`: 3 horizontes (7/30/90d) com 3 cenários (pessimista/base/agressivo)
- `runway_calculated`: meses de runway dado burn current

## Features cobertas (das 60 do Aicfo)

Identificadores: #2, #3, #57

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module cashflow` quando este módulo entrar em desenvolvimento (Onda 2).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
