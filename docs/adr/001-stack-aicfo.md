---
adr_id: "001"
title: "Stack tecnológica do Aicfo (backend + frontend monorepo)"
status: "aceita"
constitution_version: "0.3.0"
created_at: "2026-05-08"
last_updated: "2026-06-22"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C5, C6, C7, C8]
---

# ADR-001 — Stack tecnológica do Aicfo

## Contexto

Aicfo é um produto self-serve do guarda-chuva Novais Digital. Backend e frontend React compartilham o mesmo monorepo (integrado em 2026-05-14, ADR-006). O backend serve a API REST e o frontend é buildado separadamente (Railway serviço dedicado).

## Decisão

### Backend (este repo)

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js ≥20 + TypeScript 5.7 estrito (ESM) | Stack canônica Novais Digital — reuso de padrões e skills |
| Web | Fastify 5 | Performance, schema-first com Zod, baixo overhead |
| Orquestração agentes | LangGraph 1.4 | State machines para pipelines complexos do SKU; integra múltiplos providers via `src/llm/` |
| LLM primário | Google Vertex AI Gemini 2.5 Pro/Flash (ADR-009/019); OpenAI gpt-4.1-mini fallback (ADR-010) | Razão custo/qualidade + residência de dados (LGPD); reuso de adapters |
| Observability | LangSmith 0.7+ | Obrigatório por C6; padrão Novais Digital |
| DB | PostgreSQL 16 via Prisma 6 | Multi-tenant via `tenantId`; JSONB para `productConfig` |
| Filas | BullMQ 5 + ioredis 5 | Processamento assíncrono de análise (geração leva minutos) |
| Validação | Zod 3 | Schema-first; reuso entre runtime + contratos OpenAPI |
| Logs | Pino 9 | Logger estruturado, sem `console.log` |
| Tests | Vitest 1.x | Compatível com ESM/TS; rápido |

### Frontend (monorepo em `app/`)

- **Stack**: React 18 + Vite + TypeScript + TailwindCSS + TanStack Query + React Router 6
- **Contratos**: backend gera OpenAPI 3.1 em runtime; Contract Agent (`frontend_agent` AIOS reposicionado) gera `docs/contracts/{module}.openapi.yml` + `.zod.ts` + `docs/frontend-handoff/{module}.md`
- **Comunicação**: HTTP (REST) sobre JWT; sem GraphQL na Onda 0+1

### Pipeline de construção

- **AIOS Server** (Python, repositório do Foundry) orquestra agentes de spec/backend/contract/test/review por módulo
- **Daemon de sync** (`aios:sync`) roda 24/7 no Railway atualizando status no ClickUp Novais Digital via leitura de filesystem + GitHub

## Consequências

### Positivas

- **C5 cumprido**: separação clara entre L0 (DNA Aicfo), L1 (Tenant), L2 (Análise individual)
- **C7 cumprido**: única dependência de modelo em `src/llm/`; trocar provedor não exige mudar specs
- **C8 cumprido**: `tenantId` sempre via JWT claim, nunca hardcoded
- Reuso de padrões Novais Digital acelera desenvolvimento

### Negativas

- Cálculos financeiros (DRE, KPIs) ficam em TS; pandas/numpy não disponíveis (mas aritmética simples não precisa)
- Pipeline AIOS é Python — coexiste com runtime Node/TS, tem custo cognitivo

### Mitigações

- Em caso de cálculo financeiro complexo (Ondas 5-8), avaliar serviço Python isolado via fila BullMQ
- AIOS Server roda apenas em dev/CI (não em produção); zero impacto no runtime

## Alternativas consideradas

| Alternativa | Por que não foi escolhida |
|---|---|
| Python (FastAPI) end-to-end | Quebra padrão Novais Digital; perde reuso de agents/skills; sem ganho real (cálculos são simples) |
| Next.js fullstack (monorepo) | Rejeitado inicialmente, mas monorepo Vite+React foi adotado em 2026-05-14 (ADR-006) para alinhar deploy e contratos |
| GraphQL via Apollo | Overhead pra Onda 0+1; pode adicionar em Onda 4+ se múltiplos clientes externos forem consumir API |

## Aprovação

- [x] Mantenedor (Rafael)
- [x] CEO

**Aprovado por**: Rafael Novaes — 2026-06-22
