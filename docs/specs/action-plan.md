---
module_key: "action-plan"
module_name: "Action Plan — Plano de Ação 3-horizontes"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#13, #45, #46"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Action Plan — Plano de Ação 3-horizontes

> Gera plano de ação com 3 horizontes (curto: até 3m / médio: 3-6m / longo: >1 ano). Para cada ação: descrição, prazo, esforço, risco, impacto R$ estimado. Sonnet 4.6 + Opus 4.7 como fallback decisional.

## Outcomes principais

- `plan_generated`: ≥3 ações curto + ≥1 médio + ≥1 longo, cada uma com impacto R$
- `action_executable`: cada ação tem critério de "feita" mensurável
- `impact_total_calculated`: soma de impacto R$/mês dos horizontes

## Features cobertas (das 60 do Aicfo)

Identificadores: #13, #45, #46

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module action-plan` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
