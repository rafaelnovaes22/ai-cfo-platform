---
module_key: "profitability"
module_name: "Profitability — Rentabilidade Multi-Dimensão"
wave: 6
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#10, #11, #12"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Profitability — Rentabilidade Multi-Dimensão

> Análise de rentabilidade por dimensão: cliente, produto/serviço, canal de vendas. Cruzamento com módulo CRM (Onda 4) e classificação (Onda 1). Margem de contribuição por dimensão.

## Outcomes principais

- `profitability_by_customer`: ranking de rentabilidade por cliente
- `profitability_by_product`: ranking por produto/SKU
- `profitability_by_channel`: ranking por canal de vendas
- `unprofitable_flagged`: clientes/produtos com margem negativa

## Features cobertas (das 60 do Aicfo)

Identificadores: #10, #11, #12

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module profitability` quando este módulo entrar em desenvolvimento (Onda 6).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
