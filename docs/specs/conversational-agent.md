---
module_key: "conversational-agent"
module_name: "Conversational Agent — Copiloto NL"
wave: 3
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#31"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Conversational Agent — Copiloto NL

> Agente conversacional que responde perguntas em linguagem natural sobre os dados financeiros do tenant. Ex: "Quanto gastei em marketing nos últimos 3 meses?". Usa RAG sobre dados do tenant + DRE narrativa + KPIs.

## Outcomes principais

- `question_answered`: resposta gerada com fonte (link pra linha do DRE)
- `question_clarified`: pergunta ambígua → agente pede esclarecimento
- `question_out_of_scope`: pergunta fora do escopo financeiro → recusa elegante

## Features cobertas (das 60 do Aicfo)

Identificadores: #31

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module conversational-agent` quando este módulo entrar em desenvolvimento (Onda 3).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
