---
artifact_id: "cashflow"
client_id: "aicfo"
plan_path: "docs/clients/aicfo/plan-cashflow.md"
spec_path: "docs/specs/cashflow.md"
tasks_variant: "platform-aios"
generated_at: "2026-05-28"
forge_command_version: "tasks@0.2.0"
total_tasks: 21
total_waves: 5
dag_validation:
  cycles: 0
  unresolved_dependencies: 0
estimated_total_days_low: 4
estimated_total_days_high: 6
note: >
  Módulo platform (ai_enabled=false) — sem LLM em produção.
  Wave 2P substituída por Wave 2-AIOS: agentes já scaffoldados em aios/agents/cashflow/.
  TDD-first: test_agent gera RED antes do backend_agent implementar GREEN.
---

# Tasks — `cashflow` (Fase 1 MVP)

> Objetivo desta fase: `GET /cashflow` + `GET /cashflow/summary` funcionando com dados
> reais de `LedgerEntry`. Sem migrations de schema — usa tabelas existentes.
> A tela de Fluxo de Caixa sai do badge "EM BREVE".

---

## Wave 1P — Scaffolding

### T1.1 — Criar estrutura de diretórios `src/cashflow/`
- **Skill/tool**: bash / editor
- **Paths a criar**: `src/cashflow/routes.ts`, `src/cashflow/service.ts`, `src/cashflow/queries.ts`, `src/cashflow/schema.ts`, `src/cashflow/types.ts`
- **Gate de pronto**: `src/cashflow/` existe com os 5 arquivos (podem ser stubs vazios); TypeScript compila sem erro
- **Depends on**: —
- **Tier**: L1
- **Trace required**: false

### T1.2 — Verificar auth middleware extrai `tenantId` corretamente
- **Skill/tool**: leitura de `src/auth/` + teste manual
- **Gate de pronto**: `req.auth.tenantId` disponível em qualquer rota protegida; grep por `req.auth.tenantId` retorna ≥1 uso em rotas existentes (ex: hub)
- **Depends on**: —
- **Tier**: L1
- **Trace required**: false
- **Nota**: provavelmente já passa — verificar antes de prosseguir

### T1.3 — Adicionar migration: índices compostos em `LedgerEntry`
- **Skill/tool**: `prisma migrate dev`
- **Output**: migration em `prisma/migrations/` adicionando:
  ```sql
  CREATE INDEX IF NOT EXISTS "LedgerEntry_tenantId_date_idx"
    ON "LedgerEntry"("tenantId", date);
  CREATE INDEX IF NOT EXISTS "LedgerEntry_tenantId_confirmedCategory_idx"
    ON "LedgerEntry"("tenantId", "confirmedCategory");
  ```
- **Gate de pronto**: `npx prisma migrate status` mostra migration aplicada; `EXPLAIN ANALYZE` nas queries principais usa os novos índices
- **Depends on**: T1.1
- **Tier**: L1
- **Trace required**: false

### T1.4 — Registrar rota `/cashflow` no Fastify app
- **Skill/tool**: editor — editar `src/api/` ou ponto de registro de rotas
- **Gate de pronto**: `GET /cashflow` retorna `501 Not Implemented` (stub) sem derrubar o servidor; rota aparece no `GET /openapi.json`
- **Depends on**: T1.1
- **Tier**: L1
- **Trace required**: false

---

## Wave 2-AIOS — Build (TDD-first via agentes scaffoldados)

> Agentes disponíveis em `aios/agents/cashflow/`.
> Onda 1 paralela: schema_agent + test_agent simultaneamente.
> Onda 2 sequencial: backend_agent faz testes ficarem GREEN.
> Onda 3 paralela: frontend_agent (Contract) + review_agent.

### T2.1 — [PARALELO] schema_agent: validar schema existente + confirmar suficiência para MVP

- **Skill/tool**: `/acme:aios-run --module cashflow --step schema`
- **Input para o agente**: spec v0.1.0 + plano MVP (sem migrations de schema na Fase 1)
- **Output**: `aios/agents/cashflow/schema_agent/output.md` confirmando que `LedgerEntry` + `MonthlyAnalysis.openingBalanceCents` são suficientes para o MVP; lista os índices necessários (cobertos em T1.3)
- **Gate de pronto**: output.md existe; **não propõe** migrations de modelo novo (BankAccount etc.) — isso é Fase 2; lista de índices coincide com T1.3
- **Depends on**: T1.1
- **Tier**: L1
- **Trace required**: false

### T2.2 — [PARALELO] test_agent: gerar ≥30 casos TDD-RED para `cashflow_loaded`

- **Skill/tool**: `/acme:aios-run --module cashflow --step test`
- **Modo**: TDD-RED — backend ainda não existe; testes saem da spec
- **Output**: `src/cashflow/__tests__/cashflow.test.ts` com ≥30 casos cobrindo:
  - happy path: granularity monthly/daily/quarterly
  - edge: sem lançamentos, openingBalance null, confirmedCategory null
  - security: cross-tenant attempt (deve falhar)
  - adversarial: 10k lançamentos (stress latência)
- **Gate de pronto**: `npm test -- src/cashflow` executa e todos os testes **falham** (RED confirmado — backend não existe ainda); ≥30 casos presentes; nenhum teste faz import de LLM SDK
- **Depends on**: T1.1, T1.3
- **Tier**: L1
- **Trace required**: false

### T2.3 — backend_agent: implementar `src/cashflow/` para testes ficarem GREEN

- **Skill/tool**: `/acme:aios-run --module cashflow --step backend`
- **Contexto para o agente**:
  - Spec: `docs/specs/cashflow.md`
  - Plan (queries SQL): `docs/clients/aicfo/plan-cashflow.md` §3
  - Testes RED: `src/cashflow/__tests__/cashflow.test.ts`
  - Proibido: qualquer import de LLM SDK; `tenantId` de query param
- **Output**:
  - `src/cashflow/types.ts` — CashflowSummary, ChartEntry, TableRow
  - `src/cashflow/schema.ts` — Zod: query params + response
  - `src/cashflow/queries.ts` — querySummary, queryChart, queryTable (Prisma + raw SQL)
  - `src/cashflow/service.ts` — orquestra Promise.all + calcula closingBalance
  - `src/cashflow/routes.ts` — GET /cashflow + GET /cashflow/summary + Pino log
- **Gate de pronto**: `npm test -- src/cashflow` → todos os ≥30 testes **passam** (GREEN); `npm run build` sem erro; grep por `import.*openai\|import.*anthropic\|import.*langfuse` em `src/cashflow/` retorna 0
- **Depends on**: T2.1, T2.2
- **Tier**: L1
- **Trace required**: false

### T2.4 — Gate humano: Rafael revisa código do backend_agent

- **Skill/tool**: code review manual
- **O que verificar**:
  - [ ] `tenantId` extraído exclusivamente de `req.auth.tenantId` em todas as queries
  - [ ] `Promise.all` usado para as 3 queries paralelas
  - [ ] Pino log presente nos 5 pontos declarados no plan
  - [ ] `closingBalance = openingBalance + credits - debits` correto
  - [ ] Fallback `predictedCategory` quando `confirmedCategory` null (EC8 da spec)
  - [ ] Nenhum import de SDK LLM
- **Gate de pronto**: Rafael aprova — checklist acima 100% marcado
- **Depends on**: T2.3
- **Tier**: L1
- **Trace required**: false

### T2.5 — [PARALELO] frontend_agent: gerar contrato OpenAPI + handoff doc

- **Skill/tool**: `/acme:aios-run --module cashflow --step frontend`
- **Output**:
  - `docs/contracts/cashflow.openapi.yml` — spec OpenAPI 3.1 de GET /cashflow + GET /cashflow/summary
  - `docs/contracts/cashflow.zod.ts` — schemas Zod tipados para o frontend consumir
  - `docs/frontend-handoff/cashflow.md` — guia para Eduardo: campos, filtros, comportamento de nulls
- **Gate de pronto**: `cashflow.openapi.yml` valida com `swagger-cli validate`; `cashflow.zod.ts` compila; handoff menciona comportamento de `openingBalanceCents: null`
- **Depends on**: T2.4
- **Tier**: L1
- **Trace required**: false

### T2.6 — [PARALELO] review_agent: validar conformidade C5/C6/C7/C8

- **Skill/tool**: `/acme:aios-run --module cashflow --step review`
- **Output**: `aios/agents/cashflow/review_agent/output.md` com resultado por princípio
- **Gate de pronto**: output.md **não contém** a string "BLOCKER"; warnings aceitáveis se explicados; C8 cross-tenant confirmado; C6 Pino log confirmado; C7 sem LLM SDK confirmado
- **Depends on**: T2.4
- **Tier**: L1
- **Trace required**: false

---

## Wave 3P — Eval suite (gate C4)

### T3.1 — Seed eval cases em `evals/cashflow/cases/`

- **Skill/tool**: reutilizar testes do test_agent como base + complementar manualmente
- **Output**: ≥30 arquivos `.json` em `evals/cashflow/cases/` cobrindo distribuição da spec §6:
  - 13 happy path (monthly/daily/quarterly)
  - 5 edge (sem lançamentos, openingBalance null, category null)
  - 3 summary (alias diário)
  - 5 auth/security
  - 3 adversarial (stress)
  - 1+ adversarial (período futuro)
- **Gate de pronto**: `ls evals/cashflow/cases/ | wc -l` ≥ 30; distribuição ≥1 adversarial e ≥1 edge; 0% LLM-as-judge (exact_match)
- **Depends on**: T2.3
- **Tier**: L1
- **Trace required**: false

### T3.2 — Validar suite (sem sintéticos excessivos, sem duplicatas)

- **Skill/tool**: script lint manual ou `npm run eval -- --module cashflow --dry-run`
- **Gate de pronto**: ≤40% sintético; 0 duplicatas; toda entrada tem `expected_status`, `expected_summary_fields`, `expected_table_rows_min`
- **Depends on**: T3.1
- **Tier**: L1
- **Trace required**: false

---

## Wave 4P — PILOT prep

### T4.1 — Criar `pilot-state.md` do módulo cashflow

- **Skill/tool**: editor (a partir do template `templates/platform-module-spec.template.md` §7)
- **Output**: `docs/specs/cashflow.pilot-state.md`
  ```yaml
  module_id: cashflow
  estado_atual: DRAFT
  responsavel: Rafael Novaes
  spec_version: 0.1.0
  pilot_start_date: null
  pilot_end_date: null
  acceptance_threshold: 1.00
  ```
- **Gate de pronto**: arquivo existe e parseia; `estado_atual: DRAFT`
- **Depends on**: T2.6
- **Tier**: L1
- **Trace required**: false

### T4.2 — Abrir PR + rodar `/acme:pre-merge-check`

- **Skill/tool**: `gh pr create` + `/acme:pre-merge-check`
- **Branch**: `feat/aicfo-cashflow-fase1-mvp`
- **PR title**: `feat(cashflow): GET /cashflow MVP — Fase 1 sem migrations`
- **Gate de pronto**: pre-merge-check retorna `go` nos 5 gates (G1 C7, G2 C8, G3 C6, G4 manifest, G5 eval); PR aberto com link; `npm test` verde no CI
- **Depends on**: T3.2, T4.1
- **Tier**: L1
- **Trace required**: false

### T4.3 — Merge + promover para STAGING

- **Skill/tool**: merge do PR + `/acme:promote --module cashflow --to to_staging`
- **Gate de pronto**: `pilot-state.md` com `estado_atual: STAGING`; deploy em staging Railway sem erro; `GET /cashflow` responde 200 com dados reais em staging
- **Depends on**: T4.2
- **Tier**: L1
- **Trace required**: false

### T4.4 — Janela de observação STAGING (14 dias)

- **Skill/tool**: monitoramento passivo — Pino logs + Railway metrics
- **Gate de pronto**: 14 dias em STAGING com `latency_p95 < 800ms`; zero erro cross-tenant; zero 500 em produção; `agreement_rate = 1.00` (determinístico)
- **Depends on**: T4.3
- **Tier**: L1
- **Trace required**: false

---

## Wave 6P — CI/CD (mínimo necessário para merge)

### T6.1 — Garantir `cashflow` no `forge-validate.yml` existente

- **Skill/tool**: editor — verificar se `.github/workflows/` já cobre módulos novos automaticamente
- **Gate de pronto**: PR com mudança em `src/cashflow/` dispara CI; `pre-merge-check` roda no CI
- **Depends on**: T1.1
- **Tier**: L1
- **Trace required**: false

### T6.2 — Adicionar `cashflow` ao manifest Forge

- **Skill/tool**: editor — `docs/forge/manifest.json`
- **Output**: entrada do módulo cashflow no manifest com `status: "detailed"`, `wave: 2`, `spec_path`
- **Gate de pronto**: `npm run forge:doctor` sem erro; hook `manifest-sync` não bloqueia
- **Depends on**: T2.6
- **Tier**: L1
- **Trace required**: false

---

## DAG resumido

```
T1.1 ──┬──→ T1.3 ──→ T2.2 (test RED) ──┐
       │                                  ├──→ T2.3 (backend GREEN) ──→ T2.4 (gate Rafael) ──┬──→ T2.5 (contract)
       ├──→ T1.4 (rota stub)              │                                                    └──→ T2.6 (review)
       └──→ T2.1 (schema) ───────────────┘
T1.2 (verificação independente)

T2.3 ──→ T3.1 ──→ T3.2 ──→ T4.2 (pre-merge) ──→ T4.3 (merge+STAGING) ──→ T4.4 (14d)
T2.6 ──→ T4.1 (pilot-state) ──→ T4.2

T1.1 ──→ T6.1
T2.6 ──→ T6.2
```

---

## Checklist de execução (ordem sugerida)

```
Dia 1 — manhã
 [ ] T1.1  criar src/cashflow/ (5 arquivos stub)
 [ ] T1.2  verificar auth middleware
 [ ] T1.4  registrar rota stub no Fastify

Dia 1 — tarde
 [ ] T1.3  migration índices Prisma

Dia 2 — paralelo
 [ ] T2.1  schema_agent (valida schema existente)
 [ ] T2.2  test_agent (gera ≥30 testes RED)

Dia 3
 [ ] T2.3  backend_agent (implementa GREEN)
 [ ] T2.4  ← GATE HUMANO: Rafael revisa código

Dia 4 — paralelo (após T2.4)
 [ ] T2.5  frontend_agent (OpenAPI + handoff)
 [ ] T2.6  review_agent (C5/C6/C7/C8)

Dia 4 — tarde
 [ ] T3.1  seed eval cases
 [ ] T3.2  validar suite
 [ ] T4.1  criar pilot-state.md
 [ ] T6.1  verificar CI
 [ ] T6.2  atualizar manifest

Dia 5
 [ ] T4.2  PR + pre-merge-check ← GO/NO-GO
 [ ] T4.3  merge + promover STAGING
```
