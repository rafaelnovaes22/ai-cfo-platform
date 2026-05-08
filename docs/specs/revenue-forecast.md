---
module_key: "revenue-forecast"
module_name: "Revenue Forecast — Previsão de Faturamento"
wave: 4
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#37, #39"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Revenue Forecast — Previsão de Faturamento

> Previsão de faturamento baseada em histórico + pipeline de vendas (CRM). Correlação entre vendas futuras (probabilidade × ticket) e impacto no caixa projetado.

## Outcomes principais

- `forecast_generated`: previsão 3/6/12 meses com intervalo de confiança
- `pipeline_correlated`: oportunidades CRM convertidas em projeção de receita
- `accuracy_measured`: comparação previsto vs. realizado mensal

## Features cobertas (das 60 do Aicfo)

Identificadores: #37, #39

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module revenue-forecast` quando este módulo entrar em desenvolvimento (Onda 4).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
