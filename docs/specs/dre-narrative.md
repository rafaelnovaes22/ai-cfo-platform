---
module_key: "dre-narrative"
module_name: "DRE Narrative — Narrador da DRE"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#8, #14, #15"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# DRE Narrative — Narrador da DRE

> Agrega lançamentos classificados em DRE Facilitado. Gera 3 cards de "Leitura da história" (Gargalo crítico / Atenção / Saudável), cada um com causa identificada + evidência numérica + cor visual.

## Outcomes principais

- `dre_aggregated`: DRE com todas as linhas calculadas (Receita Bruta → Lucro Líquido)
- `narrative_generated`: 3 cards (1 por categoria) com texto + numbers
- `anomaly_flagged`: variação >X% vs. mês anterior gera card de gargalo

## Features cobertas (das 60 do Aicfo)

Identificadores: #8, #14, #15

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module dre-narrative` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
