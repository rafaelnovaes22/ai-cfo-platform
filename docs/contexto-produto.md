# Contexto do produto Aicfo (referência)

> Extraído do `CLAUDE.md` em 2026-08-06 para reduzir o contexto relido a cada
> iteração de agente. O `CLAUDE.md` guarda apenas instrução operacional; este
> arquivo guarda o contexto de negócio e a explicação dos mecanismos.

## O que é o Aicfo

Produto **self-serve** que entrega análise financeira mensal para PMEs:
- Cliente loga, importa lançamentos (planilha colada, PDF do contador, Excel/CSV ou manual)
- Em <5 min, recebe DRE Facilitado com narrativa da IA + Plano de Ação 3-horizontes
- Cobrança: mensalidade fixa + tier por volume de lançamentos / empresas

CFO-IA / Plataforma de gestão financeira inteligente para PMEs. Produto self-serve
do guarda-chuva **Novais Digital SaaS²**. Operado pelo framework
**Novais Digital Foundry v0.22.1** ([`docs/foundry/README.md`](foundry/README.md)).

## ICP

- **Persona primária**: CEO/sócio/CFO de PME R$500k–R$10M faturamento
- **Pain principal**: não tem visão financeira em tempo real sem pagar consultor caro
- **Como descobre**: SEO, indicação, parcerias contábeis

## SKU piloto: `monthly-analysis`

- **Outcome cobrável**: 1 análise financeira mensal entregue, contendo DRE + 3 cards de leitura + Plano 3-horizontes
- **Spec**: [`src/skus/monthly-analysis/spec.md`](../src/skus/monthly-analysis/spec.md)
- **Unit economics**: [`docs/onda-0/unit_economics.md`](onda-0/unit_economics.md)
- **SLA**: [`docs/onda-0/sla_threshold.md`](onda-0/sla_threshold.md)

## Modos por subscription (C4)

| Modo | Comportamento |
|---|---|
| **SHADOW** | Análise gerada mas não entregue ao cliente; humano (Rafael) revisa em paralelo |
| **PILOT** | Análise entregue normalmente para ≤50 clientes controlados; CEO monitora ativamente; sem cobrança variável adicional nesta fase |
| **ASSISTED** | Análise gerada + entregue; cliente pode editar/comentar antes de "fechar" o mês |
| **AUTONOMOUS** | Análise entregue diretamente; cliente audita amostra |

Promoção entre modos exige eval suite passing + N execuções no modo atual +
aprovação humana. Entrada em PILOT pode usar Synthetic pre-validation
(Rota B — ADR-013) no lugar de 14 dias de SHADOW.

## Documentos canônicos

| Quando ler | Documento |
|---|---|
| Visão geral do produto + roadmap | [`docs/product-vision.md`](product-vision.md) |
| Decisões estratégicas Onda 0 | [`docs/onda-0/`](onda-0/) |
| Specs por módulo (30 módulos, 8 ondas) | [`docs/specs/{module}.md`](specs/) |
| Contratos OpenAPI gerados | [`docs/contracts/{module}.openapi.yml`](contracts/) |
| Decisões arquiteturais (ADRs) | [`docs/adr/`](adr/) |

## Documentos do Foundry

- [`docs/foundry/README.md`](foundry/README.md) — Overview
- [`docs/foundry/manifest.json`](foundry/manifest.json) — Inventory machine-readable
- [`docs/foundry/decisions.md`](foundry/decisions.md) — Decisões F1-F27
- [`docs/foundry/reviewer-contract.md`](foundry/reviewer-contract.md) — Contrato com DeepAgent

## Stack

- **Runtime**: Node.js ≥20, TypeScript 5.7 estrito, ESM
- **Web**: Fastify 5
- **Orquestração de agentes**: `@langchain/langgraph` 1.2
- **LLM primário**: Google Vertex AI (Gemini) via `@google/genai` 2.6 — ADR-009 (`southamerica-east1`, LGPD-compliant)
- **LLM fallback**: OpenAI `gpt-4.1-mini` via `openai` 6.37 — ADR-010 (pós-DPA)
- **Observability**: `langsmith` 0.7.1 (tracing LLM canônico — C6); WireLog para eventos de negócio (opcional, ver Foundry v0.22.0+)
- **DB**: PostgreSQL 16 via Prisma 6
- **Filas**: BullMQ 5 + ioredis 5
- **Validação**: Zod 3
- **Logs**: Pino 9
- **Tests**: Vitest

### Frontend

Este repositório é **backend-only**. O backend expõe contratos OpenAPI 3.1 + Zod
para qualquer cliente consumir.

`frontend_agent` do AIOS está reposicionado como **Contract Agent**: gera
`docs/contracts/{module}.openapi.yml` + `docs/contracts/{module}.zod.ts` —
**não gera código React**.

## Telemetria (C6) — forma canônica

Toda chamada LLM em `src/agents/**` ou `src/skus/**/nodes/**` deve estar
instrumentada com LangSmith:

```ts
import { traceable } from "langsmith/traceable";

const classifyOutcome = traceable(
  async (input: { tenantId: string; payload: unknown }) => {
    const response = await llm.call(...);
    return response;
  },
  {
    name: "outcome-classifier",
    metadata: { sku: "monthly-analysis", outcomeType: "classification" },
  },
);
```

Sem trace, **não conta como outcome auditável**. WireLog (Foundry v0.22.0+) é
opcional para eventos de negócio/outcomes — não substitui LangSmith.

## Three-tier context (C5)

| Tier | Conteúdo | Lê de |
|---|---|---|
| **L0** | DNA Aicfo, ICP, ofertas, glossário (cacheado, helper pattern) | apenas L0 |
| **L1** | Tenant (empresa cliente), conexões bancárias/ERP, BaselineCost, segmento | L0 + L1 |
| **L2** | SKU (Outcome individual: Análise, DRE, Card, Action) | L0 + L1 + L2 |

Quebrar a hierarquia (ex: skill L0 lendo Outcome) **viola C5** e bloqueia merge.

## Reviewer externo: DeepAgent / GPT-5.5

Auditoria mensal por DeepAgent externo que valida os 8 princípios da Constitution
e a coerência entre artefatos. Contrato em
[`docs/foundry/reviewer-contract.md`](foundry/reviewer-contract.md).

Para que o reviewer funcione:
- Toda mudança no Foundry atualiza `docs/foundry/manifest.json` (hook `manifest-sync`)
- Toda LLM call tem trace LangSmith (C6)
- Toda promoção de modo (SHADOW → ASSISTED → AUTONOMOUS) é registrada via `/novais-digital:promote`

## Pipeline AIOS por módulo

Para cada módulo (exceto Tier C):
`spec → tests (TDD-RED) → backend → contract (frontend_agent) → review → merge`

**Pipeline TDD-first**: o `test_agent` roda imediatamente após a spec aprovada,
antes do backend. Os testes gerados são o contrato executável da spec e devem
falhar no primeiro run (RED). O `backend_agent` então implementa para fazer cada
teste passar (GREEN). Modos do `test_agent`:
- **TDD-RED** (preferencial): backend ainda não existe; testes saem da spec
- **REINFORCE** (legado): backend já implementado; testes reforçam contra `_backend_{module}.md`, mas a spec continua sendo fonte das regras

Status sincronizado com ClickUp Novais Digital via `aios:sync` (rodando 24/7 no
Railway). Lista visível: `05 Institucional Novais Digital / Plataforma Aicfo / Modulos`.

## Ondas

> Estado móvel: confirme no ClickUp ou com `/novais-digital:aios-status` antes de
> confiar. Snapshot de 2026-08-06.

- 🟢 **Onda 0 (Fundação)**: `auth-tenant`, `workspace-setup`, `billing`, `tenant-config` — todos Tier C, Rafael implementa
- 🟢 **Onda 1 (SKU piloto monthly-analysis)**: `ingest`, `classification`, `dre-narrative`, `action-plan`, `hub`, `export` — todos Tier B
- 🔴 **Ondas 2-8**: planejadas em [`docs/product-vision.md`](product-vision.md), bloqueadas até Onda 1 promover para AUTONOMOUS
