# Aicfo

> CFO-IA self-serve para PMEs. Centraliza dados financeiros, projeta caixa, recomenda decisões e gera relatórios — substituindo trabalho operacional financeiro por agentes auditáveis.

[![version](https://img.shields.io/badge/version-0.15.0-blue)](CHANGELOG.md)
[![Forge](https://img.shields.io/badge/forge-v0.15.0-orange)](docs/forge/README.md)
[![Constitution](https://img.shields.io/badge/constitution-v0.3.0-green)](.claude/CONSTITUTION.md)
[![Status](https://img.shields.io/badge/status-shadow-yellow)](src/skus/monthly-analysis/spec.md)

---

## Stack

Backend Node.js 20 + TypeScript 5.7 (estrito, ESM) + Fastify 5 + LangGraph 1.2 + Anthropic SDK + Langfuse + Prisma 6 + Postgres + BullMQ + Redis + Zod + Pino + Vitest.

Frontend em **repositório separado** mantido pelo dev frontend interno. Backend entrega contratos OpenAPI 3.1 + Zod schemas via Contract Agent (`frontend_agent` AIOS reposicionado).

## SKU piloto

`monthly-analysis` — análise financeira mensal entregue em <5 min após import dos lançamentos:

1. DRE Facilitado classificado e narrado
2. 3 cards de "Leitura da história" (Gargalo crítico / Atenção / Saudável)
3. Plano de Ação 3-horizontes com impacto R$ estimado por ação

Detalhe: [`src/skus/monthly-analysis/spec.md`](src/skus/monthly-analysis/spec.md).

## Roadmap

30 módulos em 8 ondas. Detalhe: [`docs/product-vision.md`](docs/product-vision.md).

## Setup local

```bash
git clone https://github.com/acme-startup/aicfo.git
cd aicfo
npm install
cp .env.example .env  # preencher chaves
npm run db:generate
npm run db:push
npm run dev
```

## Comandos úteis

| Comando | Para que serve |
|---|---|
| `npm run dev` | Dev server com hot reload |
| `npm run build` | Build de produção (tsup) |
| `npm test` | Vitest |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:studio` | Prisma Studio (UI do DB) |

### Slash commands do Forge (Claude Code)

| Comando | Para que serve |
|---|---|
| `/acme:diagnose` | Diagnóstico estruturado pré-design (C1) |
| `/acme:spec` | Gera spec de SKU/módulo |
| `/acme:plan` | Quebra spec em plano técnico |
| `/acme:tasks` | Quebra plan em checklist de tasks |
| `/acme:eval` | Executa eval suite |
| `/acme:promote` | Gate de promoção SHADOW → ASSISTED → AUTONOMOUS |
| `/acme:audit-monthly` | Auditoria mensal pelo reviewer DeepAgent |
| `/acme:aios-init --module {key}` | Scaffolda agentes AIOS de um módulo |
| `/acme:aios-run --module {key}` | Executa pipeline AIOS com gates humanos |
| `/acme:aios-status` | Dashboard do progresso |

## Governança

- **Constitution**: 8 princípios em [`.claude/CONSTITUTION.md`](.claude/CONSTITUTION.md). Mudança exige ADR.
- **Reviewer mensal**: DeepAgent (GPT-5.5) audita coerência entre artefatos.
- **Pipeline construção**: AIOS Server orquestra agentes de spec/backend/contract/test/review por módulo.
- **Sync ClickUp**: status atualiza automaticamente em `05 Institucional Acme / Plataforma Aicfo` via `aios:sync` rodando 24/7 no Railway.

## Convenção de naming (sync GitHub → ClickUp)

Toda branch e PR neste repo deve mencionar o `key` do módulo:

```
feat/aicfo-ingest-csv-parser       # branch
feat(ingest): add CSV parser        # PR title (conventional commits)
```

Sem isso o sync não casa PR ↔ módulo no ClickUp e o status fica parado.

## Licença

Repositório privado. Propriedade da Acme / Novais Digital.
