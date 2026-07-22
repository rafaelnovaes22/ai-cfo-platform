---
module_key: "financial-planning"
module_name: "Financial Planning — Anual + Orçamentário Dinâmico"
wave: 8
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#54, #55"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Financial Planning — Anual + Orçamentário Dinâmico

> Planejamento financeiro anual automatizado a partir do histórico + metas. Orçamentário com ajuste dinâmico ao longo do ano (mês fechado realimenta projeção).

## Outcomes principais

- `annual_plan_generated`: planejamento anual com metas mensais
- `budget_adjusted`: orçamento ajustado em função do realizado
- `variance_analyzed`: análise mensal de orçado vs. realizado

## Features cobertas (das 60 do Aicfo)

Identificadores: #54, #55

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module financial-planning` quando este módulo entrar em desenvolvimento (Onda 8).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
