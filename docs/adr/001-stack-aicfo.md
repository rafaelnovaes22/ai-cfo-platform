---
adr_id: "001"
title: "Stack tecnológica do Aicfo (backend + relação com frontend separado)"
status: "proposta"
constitution_version: "0.2.0"
created_at: "2026-05-08"
last_updated: "2026-05-08"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C5, C6, C7, C8]
---

# ADR-001 — Stack tecnológica do Aicfo

## Contexto

Aicfo é um produto self-serve do guarda-chuva Acme. Frontend é desenvolvido em repositório separado por dev interno; backend (este repo) precisa servir o frontend e suportar pipeline AIOS de construção.

## Decisão

### Backend (este repo)

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js ≥20 + TypeScript 5.7 estrito (ESM) | Stack canônica Acme — reuso de padrões e skills |
| Web | Fastify 5 | Performance, schema-first com Zod, baixo overhead |
| Orquestração agentes | LangGraph 1.2 | State machines para pipelines complexos do SKU; integra Anthropic SDK |
| LLM primário | Anthropic SDK 0.39 (Sonnet 4.6 default; Opus 4.7 só onde necessário) | Razão custo/qualidade; reuso de prompt cache via Forge |
| Observability | Langfuse 3.38 | Obrigatório por C6; padrão Acme |
| DB | PostgreSQL 16 via Prisma 6 | Multi-tenant via `tenantId`; JSONB para `productConfig` |
| Filas | BullMQ 5 + ioredis 5 | Processamento assíncrono de análise (geração leva minutos) |
| Validação | Zod 3 | Schema-first; reuso entre runtime + contratos OpenAPI |
| Logs | Pino 9 | Logger estruturado, sem `console.log` |
| Tests | Vitest 1.x | Compatível com ESM/TS; rápido |

### Frontend (repositório separado)

- **Stack**: definida pelo dev frontend interno; não opinamos
- **Contratos**: backend gera OpenAPI 3.1 + Zod schemas + handoff doc por módulo via Contract Agent (`frontend_agent` AIOS reposicionado)
- **Comunicação**: HTTP (REST) sobre JWT; sem GraphQL na Onda 0+1

### Pipeline de construção

- **AIOS Server** (Python, repositório do Forge) orquestra agentes de spec/backend/contract/test/review por módulo
- **Daemon de sync** (`aios:sync`) roda 24/7 no Railway atualizando status no ClickUp Acme via leitura de filesystem + GitHub

## Consequências

### Positivas

- **C5 cumprido**: separação clara entre L0 (DNA Aicfo), L1 (Tenant), L2 (Análise individual)
- **C7 cumprido**: única dependência de modelo em `src/llm/`; trocar provedor não exige mudar specs
- **C8 cumprido**: `tenantId` sempre via JWT claim, nunca hardcoded
- Reuso de padrões Acme acelera desenvolvimento

### Negativas

- Cálculos financeiros (DRE, KPIs) ficam em TS; pandas/numpy não disponíveis (mas aritmética simples não precisa)
- Pipeline AIOS é Python — coexiste com runtime Node/TS, tem custo cognitivo

### Mitigações

- Em caso de cálculo financeiro complexo (Ondas 5-8), avaliar serviço Python isolado via fila BullMQ
- AIOS Server roda apenas em dev/CI (não em produção); zero impacto no runtime

## Alternativas consideradas

| Alternativa | Por que não foi escolhida |
|---|---|
| Python (FastAPI) end-to-end | Quebra padrão Acme; perde reuso de agents/skills; sem ganho real (cálculos são simples) |
| Next.js fullstack (monorepo) | Frontend é repo separado por decisão organizacional; sem sentido juntar |
| GraphQL via Apollo | Overhead pra Onda 0+1; pode adicionar em Onda 4+ se múltiplos clientes externos forem consumir API |

## Aprovação

- [ ] Mantenedor (Rafael)
- [ ] CEO

**Aprovado por**: pendente
