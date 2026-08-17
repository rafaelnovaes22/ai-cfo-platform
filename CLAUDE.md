# Aicfo — Guia para Claude Code

Backend-only. CFO-IA para PMEs, operado pelo framework Novais Digital Foundry.
Contexto de produto, stack, ICP, modos de subscription e pipeline AIOS:
[`docs/contexto-produto.md`](docs/contexto-produto.md) — leia sob demanda, não por padrão.

## Antes de qualquer coisa

Leia [`.claude/CONSTITUTION.md`](.claude/CONSTITUTION.md). Os 8 princípios são
não-negociáveis: **C1** diagnose-before-design · **C2** outcome-first ·
**C3** custo ≤ 25% do preço · **C4** SHADOW antes de cobrar · **C5** three-tier
context (L0/L1/L2) · **C6** telemetry-by-default · **C7** portability over
lock-in · **C8** anti-customização heroica.

Se uma instrução do usuário conflitar com a Constitution, **levante o conflito**
antes de executar.

## Comandos

```bash
npm run dev              # tsx watch + .env
npm run build            # tsup
npm test                 # vitest run
npm run db:migrate       # prisma migrate dev
npm run db:studio        # prisma studio
npm run foundry:doctor   # valida consistência da estrutura Foundry
```

## Gitflow: 2 níveis (`staging` → `main`)

**Nunca fazer push direto em `main` nem em `staging`.** Dev e agentes trabalham em
paralelo; push direto gera conflito silencioso e pula homologação. Cada branch tem
um serviço Railway com auto-deploy (`staging` = homologação, `main` = produção).

```bash
git checkout staging && git pull
git checkout -b feat/aicfo-{module}-{descrição}
git commit -m "feat({module}): ..."
gh pr create --title "feat({module}): ..." --base staging   # CI verde → auto-merge
gh pr create --title "release: staging → main" --base main --head staging
```

- PR com base `staging`: o job `auto-merge` do CI faz squash-merge quando `validate` passa ([ci.yml](.github/workflows/ci.yml)). Sem aprovação manual.
- PR com base `main`: merge **deliberado** por humano. Não entra no auto-merge.
- Toda mudança em `src/` passa por `/novais-digital:pre-merge-check` antes do merge.
- Exceção: hotfix crítico de segurança com aprovação explícita do CEO.

**Branch, PR e commit devem citar o `key` do módulo** — sem isso o `aios:sync` do
`clickup-automation` não atualiza status no ClickUp. Keys válidos: `auth-tenant`,
`workspace-setup`, `billing`, `tenant-config`, `ingest`, `classification`,
`dre-narrative`, `action-plan`, `hub`, `export`, `cashflow`, `kpis`, `score`,
`alerts`, `dashboard-ceo`, `decision-engine`, `scenarios`, `benchmarking`,
`conversational-agent`, `integrations-banks`, `integrations-erp-crm-payroll`,
`payment-execution`, `revenue-forecast`, `tax-suite`, `accounts-management`,
`bank-reconciliation`, `profitability`, `anomaly-fraud-detection`,
`audit-governance`, `financial-planning`.

## Onde mora cada coisa

```
src/api/                 # Fastify routes
src/skus/{sku-code}/     # SKUs verticais (spec.md + prompts/ + nodes/)
src/llm/                 # abstração de modelos (C7) — único lugar com SDK de LLM
src/observability/       # wrapper LangSmith (C6)
src/persistence/         # Prisma client + repositories
src/{auth,billing,ingest}/
docs/{adr,foundry,onda-0,specs,contracts}/
evals/{module}/          # eval suites versionadas
prisma/                  # schema.prisma + migrations
aios/                    # AIOS Server config + agents
.claude/{CONSTITUTION.md,commands,agents,skills}/
hooks/                   # 9 hooks runtime ativos
```

## Regras de toque

| Path | Regra |
|---|---|
| `.claude/CONSTITUTION.md` | Mudança exige ADR + bump de versão (hook bloqueia) |
| `docs/adr/*.md` | ADR assinada não muda; abrir nova ADR (hook bloqueia) |
| `docs/onda-0/sku_piloto.md` (aprovado) | Cláusula de outcome aprovada não muda sem reaprovação |
| `src/llm/**` | Toda dependência de modelo vive aqui (C7) |
| `docs/contracts/**` | Gerado pelo Contract Agent; editar à mão só com justificativa em PR |
| `src/skus/{sku}/**` | Edição livre; segue templates Foundry |

## Convenções de código

Além das regras globais de clean code: nada de `any` em `src/skus/**` ou
`src/agents/**` (hook `any-type-guard` bloqueia); ESM puro (`import`, sem
`require`); logger Pino, nunca `console.log`; conventional commits
`feat({module}): ...`; datas em YYYY-MM-DD absoluto.

**Toda chamada LLM precisa de trace LangSmith** (C6) — sem trace não conta como
outcome auditável. Forma canônica com `traceable` em
[`docs/contexto-produto.md`](docs/contexto-produto.md#telemetria-c6--forma-canônica).

## Pedir confirmação antes de

Editar `.claude/CONSTITUTION.md`, ADR assinada ou `docs/onda-0/sku_piloto.md`
aprovado; promover subscription de modo; `npm publish`, `prisma migrate reset`,
`git push --force`, `rm -rf`; push direto para `main`.

Operações reversíveis e locais (`src/skus/`, eval cases, prompts, `docs/specs/`)
não exigem confirmação — só siga os padrões.

## Comandos AIOS

- `/novais-digital:aios-init --module {key} --tier {A|B|C}` — scaffolda agentes
- `/novais-digital:aios-run --module {key}` — executa pipeline com gates humanos (C4)
- `/novais-digital:aios-status` — dashboard do progresso
