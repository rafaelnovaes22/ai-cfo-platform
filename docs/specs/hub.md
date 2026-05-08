---
module_key: "hub"
module_name: "Hub — Home + Análises Anteriores"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#23"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Hub — Home + Análises Anteriores

> Tela home pós-login. Mostra análise current (lucro líquido + tags "3 gargalos"/"Plano pronto"), lista de análises anteriores (até 12 meses), CTAs ("Ver DRE completo", "Iniciar nova análise").

## Outcomes principais

- `hub_loaded`: home renderizada com snapshot da última análise
- `history_listed`: análises anteriores ordenadas por data ref
- `new_analysis_triggered`: cliente inicia nova análise

## Features cobertas (das 60 do Aicfo)

Identificadores: #23

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module hub` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
