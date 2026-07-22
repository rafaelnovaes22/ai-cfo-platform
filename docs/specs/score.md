---
module_key: "score"
module_name: "Score — Score Financeiro da Empresa"
wave: 2
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#40"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Score — Score Financeiro da Empresa

> Indicador único 0-100 que sintetiza saúde financeira (combinando margem, runway, inadimplência, crescimento, etc). Versão simplificada do CEO entender em 5s.

## Outcomes principais

- `score_calculated`: score current com breakdown dos componentes
- `score_history`: evolução mensal
- `score_drop_alert`: queda relevante dispara incidente

## Features cobertas (das 60 do Aicfo)

Identificadores: #40

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module score` quando este módulo entrar em desenvolvimento (Onda 2).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
