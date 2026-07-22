---
module_key: "auth-tenant"
module_name: "Autenticação Multi-Tenant"
wave: 0
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "(transversal — segurança)"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Autenticação Multi-Tenant

> Login, sessão, JWT, isolamento de tenant. Camada de segurança transversal a todos os módulos.

## Outcomes principais

- `user_authenticated`: usuário loga com sucesso (email+senha, futuramente SSO)
- `tenant_resolved`: JWT contém claim `tenant_id` válido em toda request
- `session_refreshed`: refresh token funcionando

## Features cobertas (das 60 do Aicfo)

Identificadores: (transversal — segurança)

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module auth-tenant` quando este módulo entrar em desenvolvimento (Onda 0).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
