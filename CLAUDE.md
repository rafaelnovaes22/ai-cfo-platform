# Aicfo — Guia para Claude Code

> CFO-IA / Plataforma de gestão financeira inteligente para PMEs. Produto self-serve do guarda-chuva **Novais Digital SaaS²**.
> Operado pelo framework **Novais Digital Foundry v0.22.1** ([`docs/foundry/README.md`](docs/foundry/README.md)).
>
> **Prompt de orquestração**: [`MASTER_PROMPT.md`](MASTER_PROMPT.md) — lifecycle, Constitution e stack.
> **Onboarding não-técnico**: [`HELLO.md`](HELLO.md) | **Dev novo**: [`QUICKSTART_DEV.md`](QUICKSTART_DEV.md) | **Erros comuns**: [`COMMON_ERRORS.md`](COMMON_ERRORS.md)

---

## Antes de qualquer coisa: leia a Constitution

**Arquivo obrigatório**: [`.claude/CONSTITUTION.md`](.claude/CONSTITUTION.md)

Os 8 princípios listados ali são **não-negociáveis** e orientam toda decisão de design, implementação e revisão neste repositório:

1. **C1** — Diagnose-before-design
2. **C2** — Outcome-first, never tech-first
3. **C3** — Custo ≤ 25% do preço
4. **C4** — SHADOW antes de cobrar
5. **C5** — Three-tier context (L0/L1/L2)
6. **C6** — Telemetry-by-default (LangSmith canônico para tracing LLM; WireLog para eventos de negócio)
7. **C7** — Portability over lock-in
8. **C8** — Anti-customização heroica

Se uma instrução do usuário entrar em conflito com a Constitution, **levante o conflito** antes de executar.

---

## Contexto do projeto

### O que é o Aicfo

Produto **self-serve** que entrega análise financeira mensal para PMEs:
- Cliente loga, importa lançamentos (planilha colada, PDF do contador, Excel/CSV ou manual)
- Em <5 min, recebe DRE Facilitado com narrativa da IA + Plano de Ação 3-horizontes
- Cobrança: mensalidade fixa + tier por volume de lançamentos / empresas

### ICP

- **Persona primária**: CEO/sócio/CFO de PME R$500k–R$10M faturamento
- **Pain principal**: não tem visão financeira em tempo real sem pagar consultor caro
- **Como descobre**: SEO, indicação, parcerias contábeis

### SKU piloto: `monthly-analysis`

- **Outcome cobrável**: 1 análise financeira mensal entregue, contendo DRE + 3 cards de leitura + Plano 3-horizontes
- **Spec**: [`src/skus/monthly-analysis/spec.md`](src/skus/monthly-analysis/spec.md)
- **Unit economics**: [`docs/onda-0/unit_economics.md`](docs/onda-0/unit_economics.md)
- **SLA**: [`docs/onda-0/sla_threshold.md`](docs/onda-0/sla_threshold.md)

### Modos por subscription (C4)

| Modo | Comportamento |
|---|---|
| **SHADOW** | Análise gerada mas não entregue ao cliente; humano (Rafael) revisa em paralelo |
| **PILOT** | Análise entregue normalmente para ≤50 clientes controlados; CEO monitora ativamente; sem cobrança variável adicional nesta fase |
| **ASSISTED** | Análise gerada + entregue; cliente pode editar/comentar antes de "fechar" o mês |
| **AUTONOMOUS** | Análise entregue diretamente; cliente audita amostra |

Promoção entre modos exige eval suite passing + N execuções no modo atual + aprovação humana. Entrada em PILOT pode usar Synthetic pre-validation (Rota B — ADR-013) no lugar de 14 dias de SHADOW.

### Documentos canônicos

| Quando ler | Documento |
|---|---|
| Visão geral do produto + roadmap | [`docs/product-vision.md`](docs/product-vision.md) |
| Decisões estratégicas Onda 0 | [`docs/onda-0/`](docs/onda-0/) |
| Specs por módulo (30 módulos, 8 ondas) | [`docs/specs/{module}.md`](docs/specs/) |
| Contratos OpenAPI gerados | [`docs/contracts/{module}.openapi.yml`](docs/contracts/) |
| Decisões arquiteturais (ADRs) | [`docs/adr/`](docs/adr/) |

### Documentos do Foundry

- [`docs/foundry/README.md`](docs/foundry/README.md) — Overview
- [`docs/foundry/manifest.json`](docs/foundry/manifest.json) — Inventory machine-readable
- [`docs/foundry/decisions.md`](docs/foundry/decisions.md) — Decisões F1-F27
- [`docs/foundry/reviewer-contract.md`](docs/foundry/reviewer-contract.md) — Contrato com DeepAgent

---

## Stack do projeto

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

Este repositório é **backend-only**. O backend expõe contratos OpenAPI 3.1 + Zod para qualquer cliente consumir.

`frontend_agent` do AIOS está reposicionado como **Contract Agent**: gera `docs/contracts/{module}.openapi.yml` + `docs/contracts/{module}.zod.ts` — **não gera código React**.

### Comandos npm úteis

```bash
npm run dev              # tsx watch + .env
npm run build            # tsup
npm run db:migrate       # prisma migrate dev
npm run db:studio        # prisma studio
npm test                 # vitest run
npm run foundry:doctor     # valida consistência da estrutura Foundry
```

---

## Convenções de naming (sync GitHub → ClickUp)

O sync `aios:sync` do `clickup-automation` casa PRs com módulos buscando termos no título / branch / corpo do PR. **Toda branch e PR neste repo deve mencionar o `key` do módulo**, senão o sync não atualiza status no ClickUp.

| Padrão | Exemplo válido |
|---|---|
| Branch | `feat/aicfo-{module}-{descrição}` → `feat/aicfo-ingest-csv-parser` |
| PR title | `feat({module}): {descrição}` → `feat(ingest): add CSV parser` |
| Commits | conventional commits — `feat(ingest): ...`, `fix(dre-narrative): ...` |

**Module keys válidos**: `auth-tenant`, `workspace-setup`, `billing`, `tenant-config`, `ingest`, `classification`, `dre-narrative`, `action-plan`, `hub`, `export`, `cashflow`, `kpis`, `score`, `alerts`, `dashboard-ceo`, `decision-engine`, `scenarios`, `benchmarking`, `conversational-agent`, `integrations-banks`, `integrations-erp-crm-payroll`, `payment-execution`, `revenue-forecast`, `tax-suite`, `accounts-management`, `bank-reconciliation`, `profitability`, `anomaly-fraud-detection`, `audit-governance`, `financial-planning`.

### Gitflow obrigatório: 2 níveis (`staging` → `main`)

**Nunca fazer push direto em `main` nem em `staging`.** Múltiplos contribuidores (dev + agentes) trabalham em paralelo. Push direto gera conflitos silenciosos e pula a homologação.

O repo tem **duas branches de longa duração**, cada uma com um ambiente Railway correspondente:

| Branch | Ambiente | Deploy | Cobertura |
|---|---|---|---|
| `staging` | Homologação | auto-deploy no push | backend |
| `main` | Produção | auto-deploy no push | backend |

> A branch `dev` foi descontinuada (2026-06-19) — o fluxo praticado é de 2 níveis.

**Fluxo padrão para qualquer trabalho:**

```bash
# 1. Criar branch a partir de staging atualizado
git checkout staging && git pull
git checkout -b feat/aicfo-{module}-{descrição}

# 2. Commits convencionais na branch
git commit -m "feat({module}): ..."

# 3. Abrir PR com base staging (CI verde → auto-merge → deploy em homolog)
gh pr create --title "feat({module}): ..." --base staging

# 4. Validar em staging. Quando o lote estiver pronto para produção:
gh pr create --title "release: staging → main" --base main --head staging
#    PR para main exige merge DELIBERADO (sem auto-merge).
```

**Regras de PR:**
- PR com base `staging`: o job `auto-merge` do CI faz squash-merge automático quando `validate` passa ([ci.yml](.github/workflows/ci.yml)). Não precisa de aprovação manual.
- PR com base `main`: merge **deliberado** (humano), preservando o gate de produção. PRs contra `main` **não** entram no auto-merge.
- Título segue o padrão `feat/fix/docs({module}): descrição` para o sync ClickUp funcionar
- Toda mudança em `src/` passa por `/novais-digital:pre-merge-check` antes do merge
- Exceção permitida: hotfix crítico de segurança com aprovação explícita do CEO (PR direto para `main`)

**Ambientes (Railway):** o backend tem **dois serviços** — um seguindo `staging`, outro seguindo `main`.

---

## Padrões a seguir

### Onde mora cada coisa

```
src/
├── api/                    # Fastify routes consumidas pelo frontend
├── skus/{sku-code}/        # SKUs verticais (spec.md + prompts/ + nodes/)
├── auth/                   # auth-tenant (Onda 0)
├── billing/                # billing (Onda 0)
├── ingest/                 # parsers planilha/PDF/CSV/manual
├── llm/                    # camada de abstração de modelos (C7) — único lugar com import @anthropic-ai/sdk
├── observability/          # wrapper LangSmith (C6)
└── persistence/            # Prisma client + repositories
docs/
├── adr/                    # Architecture Decision Records
├── foundry/                  # Documentação do framework (não tocar arbitrariamente)
├── onda-0/                 # Decisões estratégicas iniciais
├── specs/                  # Specs por módulo (30 módulos)
└── contracts/              # OpenAPI + Zod gerados pelo Contract Agent
templates/                  # Templates Foundry (sku-spec, adr, eval-case, unit-economics, aios)
evals/{module}/             # Eval suites versionadas por módulo
prisma/                     # schema.prisma + migrations
aios/                       # AIOS Server config + agents (gerado por /novais-digital:aios-init)
.claude/
├── CONSTITUTION.md         # Princípios versionados (LER PRIMEIRO)
├── settings.json           # Foundry layer (versionado)
├── settings.local.json     # Overrides do dev (gitignored)
├── commands/novais-digital/        # Slash commands (Foundry-2)
├── agents/                 # Subagents Guardian (Foundry-3)
└── skills/{L0,L1,L2}/      # Skills herdadas Sincra (Foundry-1)
hooks/                      # 9 hooks runtime ativos
```

### Regras de toque

| Path | Regra |
|---|---|
| `.claude/CONSTITUTION.md` | Mudança exige ADR + bump de versão (hook bloqueia) |
| `docs/adr/*.md` | ADR assinada não muda; abrir nova ADR (hook bloqueia) |
| `docs/onda-0/sku_piloto.md` (aprovado) | Cláusula contratual de outcome aprovada não muda sem reaprovação |
| `src/skus/{sku}/**` | Edição livre; segue templates Foundry |
| `src/llm/**` | Camada de abstração — toda dependência de modelo vive aqui (C7) |
| `docs/contracts/**` | Gerado pelo Contract Agent (AIOS); editar manualmente só com justificativa em PR |

### Telemetria (C6)

Toda chamada LLM em `src/agents/**` ou `src/skus/**/nodes/**` deve estar instrumentada com LangSmith:

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

Sem trace, **não conta como outcome auditável**. WireLog (Foundry v0.22.0+) é opcional para eventos de negócio/outcomes — não substitui LangSmith.

### Three-tier context (C5)

| Tier | Conteúdo | Lê de |
|---|---|---|
| **L0** | DNA Aicfo, ICP, ofertas, glossário (cacheado, helper pattern) | apenas L0 |
| **L1** | Tenant (empresa cliente), conexões bancárias/ERP, BaselineCost, segmento | L0 + L1 |
| **L2** | SKU (Outcome individual: Análise, DRE, Card, Action) | L0 + L1 + L2 |

Quebrar a hierarquia (ex: skill L0 lendo Outcome) **viola C5** e bloqueia merge.

---

## Convenções de código

- **TypeScript estrito**: nada de `any` em `src/skus/**` ou `src/agents/**` (hook `any-type-guard` bloqueia)
- **Comentários**: só quando o WHY é não-óbvio. Não comentar o que já é claro do nome
- **ESM**: `import` apenas; sem `require`
- **Datas em commits/docs**: YYYY-MM-DD absoluto (não "ontem", "semana que vem")
- **Pino logger**: usar logger estruturado, não `console.log`
- **Conventional commits**: `feat({module}): ...`, `fix({module}): ...`, `docs({module}): ...`

---

## Reviewer externo: DeepAgent / GPT-5.5

Este projeto é auditado mensalmente por DeepAgent externo que valida os 8 princípios da Constitution e a coerência entre artefatos. Veja [`docs/foundry/reviewer-contract.md`](docs/foundry/reviewer-contract.md).

Para que o reviewer funcione:
- Toda mudança no Foundry atualiza `docs/foundry/manifest.json` (hook `manifest-sync`)
- Toda LLM call tem trace LangSmith (C6)
- Toda promoção de modo (SHADOW → ASSISTED → AUTONOMOUS) é registrada via `/novais-digital:promote`

---

## Quando pedir confirmação ao usuário

A Constitution define hard gates. Mas **sempre confirme** antes de:

- Editar `.claude/CONSTITUTION.md` (precisa nova ADR)
- Editar `docs/adr/*.md` assinada
- Editar `docs/onda-0/sku_piloto.md` aprovado
- Promover subscription de modo
- Executar `npm publish`, `prisma migrate reset`, `git push --force`, `rm -rf` (hooks negam via `settings.json`)
- Push para `main` direto (use PR sempre)

Operações reversíveis e locais (edição em `src/skus/`, criação de eval cases, mudanças em prompts, edição em `docs/specs/`) não exigem confirmação prévia — só siga os padrões.

---

## Ondas em andamento

- 🟢 **Onda 0 (Fundação)**: `auth-tenant`, `workspace-setup`, `billing`, `tenant-config` — todos Tier C, Rafael implementa
- 🟢 **Onda 1 (SKU piloto monthly-analysis)**: `ingest`, `classification`, `dre-narrative`, `action-plan`, `hub`, `export` — todos Tier B
- 🔴 **Ondas 2-8**: planejadas em [`docs/product-vision.md`](docs/product-vision.md), bloqueadas até Onda 1 promover para AUTONOMOUS

---

## Pipeline AIOS por módulo

Para cada módulo (exceto Tier C): `spec → tests (TDD-RED) → backend → contract (frontend_agent) → review → merge`

**Pipeline TDD-first**: o `test_agent` roda imediatamente após a spec aprovada — antes do backend. Os testes gerados são o contrato executável da spec e devem falhar no primeiro run (RED). O `backend_agent` então implementa para fazer cada teste passar (GREEN). Modos do `test_agent`:
- **TDD-RED** (preferencial): backend ainda não existe; testes saem da spec
- **REINFORCE** (legado): backend já implementado; testes reforçam contra `_backend_{module}.md`, mas a spec continua sendo fonte das regras

Comandos:
- `/novais-digital:aios-init --module {key} --tier {A|B|C}` — scaffolda agentes do módulo
- `/novais-digital:aios-run --module {key}` — executa pipeline com gates humanos (C4)
- `/novais-digital:aios-status` — dashboard do progresso

Status sincronizado com ClickUp Novais Digital via `aios:sync` (rodando 24/7 no Railway). Lista visível: `05 Institucional Novais Digital / Plataforma Aicfo / Modulos`.
