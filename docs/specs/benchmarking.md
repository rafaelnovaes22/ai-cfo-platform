---
module_key: "benchmarking"
module_name: "Benchmarking — Histórico Interno + Setor"
wave: 3
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#48, #49"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Benchmarking — Histórico Interno + Setor

> Compara métricas current vs. histórico interno (mês anterior, mesmo período ano passado) e vs. peers de segmento (quando houver base de dados ≥50 empresas).

## Outcomes principais

- `benchmark_internal`: comparação histórica do próprio tenant
- `benchmark_segment`: comparação com média do segmento (anonymized)
- `benchmark_quartile`: posição do tenant no quartil do segmento

## Features cobertas (das 60 do Aicfo)

Identificadores: #48, #49

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module benchmarking` quando este módulo entrar em desenvolvimento (Onda 3).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
