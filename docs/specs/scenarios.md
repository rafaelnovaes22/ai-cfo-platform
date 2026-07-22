---
module_key: "scenarios"
module_name: "Scenarios — Simuladores Dinâmicos"
wave: 3
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#4, #5, #26, #27"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Scenarios — Simuladores Dinâmicos

> Simulador de impacto financeiro em decisões: contratação, investimento, corte, mudança de pricing. Gera 3 cenários (pessimista/base/agressivo) com projeção 12 meses.

## Outcomes principais

- `scenario_simulated`: cenário com 3 variantes + delta vs. base
- `growth_simulated`: simulador de crescimento empresarial
- `cost_structure_simulated`: simulador de estrutura de custos

## Features cobertas (das 60 do Aicfo)

Identificadores: #4, #5, #26, #27

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module scenarios` quando este módulo entrar em desenvolvimento (Onda 3).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
