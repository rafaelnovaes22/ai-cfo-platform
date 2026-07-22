# Financial Document Intelligence Platform — Reference Architecture

> Multi-tenant financial analysis platform for SMBs, published as a reference architecture. All data in this repository is 100% synthetic; the codebase is meant to be read, studied, and reused as an engineering reference for LLM-powered document intelligence systems.

## Overview

The platform ingests financial records (pasted spreadsheets, accountant PDFs, Excel/CSV, manual entry), classifies them, and delivers a monthly financial analysis: a simplified income statement (DRE), narrative reading cards, and a 3-horizon action plan. Delivery happens through a web API and a WhatsApp channel.

What this repository demonstrates:

- An agentic backend where every LLM interaction is orchestrated, traced, and gated by evals before it reaches a user.
- A provider-agnostic LLM layer so model choices remain a configuration decision, not an architectural one.
- Multi-tenant isolation, outcome-based delivery modes, and versioned quality gates as first-class concerns.

## Architecture

**Core stack**

- Node.js 20, TypeScript 5.7 (strict, ESM)
- Fastify 5 for HTTP, with OpenAPI 3.1 generated from Zod schemas (`/openapi.json`, Swagger UI at `/docs`)
- PostgreSQL 16 via Prisma 6; BullMQ 5 + Redis for async analysis pipelines
- Pino structured logging

**Orchestration**

- LangGraph (`@langchain/langgraph`) drives the analysis agents: ingest → classification → DRE narrative → action plan.
- The same binary runs as web service (`RUN_WORKERS=false`) or queue worker, so HTTP and analysis workloads scale independently.

**LLM layer (provider-agnostic)**

- All model access goes through `src/llm/` (router + isolated adapters). Importing a provider SDK anywhere else is blocked by repo hooks.
- Primary provider: Google Vertex AI (Gemini), with OpenAI and Anthropic adapters as fallbacks. Swapping providers is a routing change, not a refactor.

**Channels and tenancy**

- WhatsApp channel via Meta Cloud API: account linking with short-lived JWT magic links, conversational flows backed by the same services as the HTTP API.
- Multi-tenant by design: every query is tenant-scoped; per-tenant hardcoding is a blocked pattern (`if (tenantId === ...)` fails review hooks).

**Contracts**

- This repository is backend-only. Each module ships an OpenAPI 3.1 contract plus Zod schemas (`docs/contracts/`), ready for any client to consume. Errors follow RFC 7807 Problem Details.

## Quality engineering

- **Versioned evals per module** (`evals/{module}/`): each module has a case suite run by a dedicated runner (`scripts/cashflow-staging-runner.ts` and siblings), with an external LLM-judge scoring narrative outputs.
- **Tests mirror the module taxonomy**: Vitest suites under `tests/` follow the same module structure as `src/`, so contract, unit, and integration coverage stay aligned with the specs in `docs/specs/`.
- **Tracing**: every LLM call is instrumented with LangSmith (`traceable`); untraced calls do not count as auditable outcomes.
- **Delivery modes as a promotion ladder**: SHADOW (generated, human-reviewed, not delivered) → ASSISTED (delivered, client can edit) → AUTONOMOUS (delivered, sampled audits). Promotion requires a passing eval suite plus a minimum number of runs in the current mode.
- **Architecture Decision Records** in `docs/adr/` document the significant choices (stack, staging strategy, LangGraph adoption, synthetic pre-validation).

## Running locally

```bash
git clone <this-repo>
cd ai-cfo-platform
npm install

docker compose up -d          # Postgres 16 + Redis 7
cp .env.example .env          # fill in the keys you need (LLM provider, JWT secret)

npm run db:migrate            # Prisma migrations
npm run seed:demo             # synthetic demo tenant + ledger entries
npm run dev                   # Fastify with hot reload on :3000
```

Useful commands:

| Command | Purpose |
|---|---|
| `npm test` | Vitest suite |
| `npm run build` | Production build (tsup) |
| `npm run db:studio` | Prisma Studio |
| `npm run seed:demo` | Seed synthetic demo data |

Key environment variables are documented inline in [`.env.example`](.env.example) — LLM provider credentials, `FRONTEND_ORIGIN` / `CORS_ORIGIN_PATTERN` for CORS, `APP_URL` for links sent over WhatsApp, and `STAGING_URL` for the staging runners.

## Repository map

```
src/            Fastify routes, LangGraph agents, LLM layer, channels, persistence
docs/adr/       Architecture Decision Records
docs/specs/     Module specs (source of truth for tests and contracts)
docs/contracts/ Generated OpenAPI 3.1 + Zod contracts
evals/          Versioned eval suites per module
scripts/        Runners: staging evals, load test, seeds, QA resets
prisma/         Schema and migrations
tests/          Vitest suites mirroring the module taxonomy
```

## Governance

Development is operated by the **Novais Digital Foundry** framework: a versioned constitution of engineering principles (`.claude/CONSTITUTION.md`), runtime hooks that enforce them (no `any` in agent code, no provider SDK outside `src/llm/`, no per-tenant hardcoding), and a monthly external review of artifact coherence.

## License

Copyright (c) 2026 Rafael Novaes — **Novais Digital**.

Licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE.md): you may read, study, and use it for **non-commercial** purposes. Commercial use, resale, or incorporation into a paid product/service requires the author's express authorization.
