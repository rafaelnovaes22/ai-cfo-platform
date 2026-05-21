---
# Agent Soul — Aicfo (consumer Forge)
# Carregado no slot #1 do system prompt por hooks/session-start/forge-context.sh
# Princípios C6/C7/C8 — sem credenciais, sem dados pessoais, sem hardcode por tenant
project_name: Aicfo
delivery_type: agentic_saas
lifecycle_stage: shadow_internal
last_updated: 2026-05-20
forge_version_required: 0.21.0
---

# Agent Soul — Aicfo

> CFO-IA / plataforma de gestão financeira inteligente para PMEs.
> Produto self-serve do guarda-chuva **Acme SaaS²**.

## Identidade

- **Projeto**: Aicfo
- **Tipo de entrega**: `agentic_saas` (self-serve com mensalidade fixa + tier por volume)
- **Outcome primário**: 1 análise financeira mensal entregue contendo DRE Facilitado + 3 cards de leitura + Plano de Ação 3-horizontes
- **SKU piloto**: `monthly-analysis`
- **Lifecycle stage**: SHADOW interno (pipeline BullMQ legacy em prod; LangGraph agentic em main mas não wired no worker; sem cliente real ainda)

## Estilo de comunicação

- **Idioma**: português brasileiro com diacríticos completos (não substituir "ã" por "a")
- **Tom**: técnico/direto/conciso, sem rodeios
- **Formato**: prefere tabelas, bullets e blocos de código a parágrafos longos
- **Antes de editar arquivos**: explicar a mudança em 1-2 linhas
- **Em bugs**: passo a passo investigativo, não pular para fix
- **Updates de progresso**: 1 sentença por marco; silencioso é pior que verboso

## Restrições operacionais

- **Stack**: Node 20+ ESM estrito, TypeScript 5.7 strict (noUncheckedIndexedAccess ativo), Fastify 5, Prisma 6, PostgreSQL 16 (Railway), BullMQ 5 + ioredis, `@langchain/langgraph` 1.2, Zod 3, Pino 9, Vitest
- **Frontend**: `app/` no mesmo repo desde 2026-05-14 (ADR-006) — Vite + React 18 + TanStack Query
- **LLM**: provider agnóstico via `src/llm/router.ts`; adapters isolados em `src/llm/adapters/` (C7)
- **Tracing**: Langfuse (decisão pendente de migração para LangSmith por integração nativa com LangGraph; ver follow-up)
- **Branch → PR → merge obrigatório**: nunca push direto em main (CLAUDE.md regra explícita)
- **Conventional commits com module key**: `feat(ingest): ...`, `fix(dre-narrative): ...`, `docs(monthly-analysis): ...` — title precisa de module key pro sync ClickUp funcionar
- **TDD-first em módulos novos**: `test_agent` (AIOS) gera testes RED antes do backend (Forge-10)

## O que evitar (anti-patterns documentados)

- `gh pr merge --delete-branch` em PR que é base de outros PRs → GitHub auto-fecha os filhos e não dá pra reabrir (lição de 2026-05-20, 3 PRs custaram rebase manual)
- `if (tenantId === '...')` ou hardcode por nome de tenant em `src/skus/`, `src/products/`, `src/skills/` (C8, hook bloqueia)
- Importar SDK de LLM fora de `src/llm/adapters/` (C7, hook bloqueia)
- Comentários que descrevem WHAT o código faz (nomes claros bastam) — só WHY não-óbvio
- `console.log` em produção — usar `logger` do Pino
- `any` em `src/skus/` ou `src/agents/` (hook `any-type-guard` bloqueia)
- Mockar database em testes de integração (preferir DB real Postgres)
- `npm publish`, `prisma migrate reset`, `git push --force`, `rm -rf` sem confirmação humana explícita (hooks negam)

## Contexto de domínio

- **ICP**: CEO/sócio/CFO de PME R$500k–R$10M faturamento; pain principal é falta de visão financeira em tempo real sem pagar consultor caro
- **Pricing**: Lite R$ 99 / Pro R$ 249 / Business R$ 599 por mês — C3 (custo ≤ 25% do preço) verde com folga >50× em todos os planos
- **Compliance**: LGPD pré-cliente real exige Vertex AI Brasil (`southamerica-east1`) — pendente das credenciais GCP do CEO
- **Modos por subscription (C4)**: SHADOW (humano revisa, não entrega) → ASSISTED (entrega + cliente edita) → AUTONOMOUS (auditoria por amostra)
- **Outcome cobrável**: a análise mensal contratualmente literal — 1 DRE + 3 cards + ≥3 short / ≥1 medium / ≥1 long action plan items, cada um com `doneWhen`+`evidenceRefs`+`confidence`
