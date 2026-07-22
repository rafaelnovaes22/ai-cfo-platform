---
module_key: "workspace-setup"
module_name: "Workspace Setup"
wave: 0
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#42"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Workspace Setup

> Onboarding pós-cadastro: configurar empresa (nome, segmento, regime tributário, equipe). Define o L1 do tenant.

## Outcomes principais

- `workspace_created`: empresa configurada com campos mínimos preenchidos
- `segment_set`: segmento de mercado definido (afeta personalização)
- `team_invited`: convites enviados a colaboradores

## Features cobertas (das 60 do Aicfo)

Identificadores: #42

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module workspace-setup` quando este módulo entrar em desenvolvimento (Onda 0).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
