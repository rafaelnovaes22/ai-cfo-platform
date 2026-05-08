---
module_key: "decision-engine"
module_name: "Decision Engine — Motor de Decisão Evoluído"
wave: 3
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#13 (evolução), #59"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Decision Engine — Motor de Decisão Evoluído

> Versão evoluída do action-plan piloto. Recomendações baseadas em comportamento histórico do tenant, padrões de empresas similares (benchmarking), e estado financeiro current.

## Outcomes principais

- `recommendation_generated`: ação recomendada com evidência + alternativas
- `recommendation_personalized`: contexto do tenant considerado
- `recommendation_explained`: justificativa textual pro CEO

## Features cobertas (das 60 do Aicfo)

Identificadores: #13 (evolução), #59

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module decision-engine` quando este módulo entrar em desenvolvimento (Onda 3).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
