---
module_key: "classification"
module_name: "Classification — Categorização DRE"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#6, #7"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Classification — Categorização DRE

> Classifica cada lançamento em categoria DRE (~25 categorias padrão) usando Sonnet 4.6 com prompt cache + few-shot. Aprendizado contínuo via correções do cliente alimentando RAG store.

## Outcomes principais

- `ledger_classified`: cada lançamento com categoria + confidence score
- `classification_confidence_low`: confidence <0.7, sinaliza pra revisão
- `taxonomy_drift_detected`: detectou padrão recorrente sem categoria — sugere expansão da taxonomia

## Features cobertas (das 60 do Aicfo)

Identificadores: #6, #7

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module classification` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
