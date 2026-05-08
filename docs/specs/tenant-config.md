---
module_key: "tenant-config"
module_name: "Tenant Config & Permissões"
wave: 0
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#50"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Tenant Config & Permissões

> Settings do tenant: perfil, membros, permissões (RBAC), tokens de API. Camada de controle de acesso.

## Outcomes principais

- `config_updated`: settings persistidas com validação
- `role_assigned`: permissão atribuída a usuário
- `api_token_issued`: token de API gerado com escopo definido

## Features cobertas (das 60 do Aicfo)

Identificadores: #50

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module tenant-config` quando este módulo entrar em desenvolvimento (Onda 0).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
