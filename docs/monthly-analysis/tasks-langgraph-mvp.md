---
title: Tasks — LangGraph MVP do SKU monthly-analysis (Sprints 3 + 5)
status: ready_for_execution
target_executor: Hermes Agent (autonomous PRs) or human dev
linked_plan: docs/monthly-analysis/agent-model-plan.md
linked_state: src/monthly-analysis/graph/state.ts
created_at: 2026-05-20
created_by: Claude Code (sessão Rafael)
---

# Tasks — LangGraph MVP (Sprints 3 + 5)

Decomposição em **8 tasks PR-sized** para destravar o grafo LangGraph do `monthly-analysis`, completando os Sprints 3 (orquestração) e 5 (QA gate) do [agent-model-plan.md](agent-model-plan.md).

## Pre-state em main (2026-05-20)

✅ Foundation pronta — não recriar:
- `src/llm/router.ts` — 14 task routes (5 legacy + 9 agentic) + fallback table
- `src/monthly-analysis/schemas/agents.ts` — Zod schemas pra todos os I/O dos agentes
- `src/monthly-analysis/graph/state.ts` — `MonthlyAnalysisState` com `costs[]`/`traces[]`/`errors[]`
- `src/monthly-analysis/agents/classification.ts` — `runClarityJudgeAgent`, `runDreClassificationAgent`
- `src/monthly-analysis/agents/financial-diagnosis.ts` — `detectFinancialAnomalies`, `diagnoseMargins`, `assessCashflowRisk` (rule-based, no LLM)
- `src/dre-narrative/aggregator.ts` — agrega entradas classificadas → `DreLines` (reusar)

Legacy pipeline em produção (não tocar nesta onda):
- `src/queue/workers.ts` — BullMQ workers
- `src/classification/classifier.ts`, `src/dre-narrative/narrator.ts`, `src/action-plan/generator.ts`

## Out of scope

- ❌ Substituir BullMQ por LangGraph — esta onda só **adiciona** o grafo + runner SHADOW; promoção pra default é decisão futura, pós-evals
- ❌ Re-treino, fine-tuning, troca de provider
- ❌ UI/frontend (não há mudança de contrato exposta ao app)
- ❌ Mudança em rotas `src/api/`
- ❌ Migration Prisma (nenhuma — grafo usa estado em memória + persiste resultados nos modelos existentes)

## Decisões já tomadas (não reabrir)

1. **LangGraph como orquestrador**: `@langchain/langgraph` 1.2 já está em `package.json`. Não substituir por outro framework.
2. **Estado canônico**: `MonthlyAnalysisState` em [state.ts](../../src/monthly-analysis/graph/state.ts). Adicionar campos só se necessário e justificado em PR.
3. **Convocação dos agentes existentes**: classification.ts e financial-diagnosis.ts são contrato. Refatorar internals OK, mas API exportada (nomes/assinaturas) é estável.
4. **Coexistência com BullMQ**: na primeira fase o grafo roda apenas em **SHADOW** disparado por CLI/teste, não pelo worker de produção.
5. **Modelo por agente**: usar `resolveRoute("<task>")` do router — nunca hardcodar provider/model no agente.
6. **Custos e traces**: cada agente que chama LLM deve **append** em `state.costs` e `state.traces`; nenhum agente persiste em DB diretamente — quem persiste é o nó `finalize` no fim do grafo.

---

## Wave 3.A — Graph skeleton

### Task 3.A.1 — Criar grafo vazio + dois nós triviais
**Outcome**: arquivo `src/monthly-analysis/graph/index.ts` exporta `buildMonthlyAnalysisGraph()` que retorna um `StateGraph<MonthlyAnalysisState>` com os nós `load_analysis` (lê Prisma → preenche `state.normalizedEntries` se já existir; senão deixa vazio) e `finalize` (loga `state.costs.length`, retorna state). Edge: `START → load_analysis → finalize → END`.

**Files**:
- ADD `src/monthly-analysis/graph/index.ts` (~80 lines)
- ADD `src/monthly-analysis/graph/nodes/load-analysis.ts` (~40 lines)
- ADD `src/monthly-analysis/graph/nodes/finalize.ts` (~30 lines)

**Acceptance**:
- `npm test` — adicionar `tests/monthly-analysis/graph-skeleton.test.ts` com um teste que invoca `buildMonthlyAnalysisGraph().compile().invoke({ analysisId, tenantId })` e verifica que `result.costs` e `result.traces` são arrays (mesmo que vazios)
- `npx tsc --noEmit` clean

**Deps**: nenhuma.

---

### Task 3.A.2 — Agente `normalization` (LLM gpt-4.1-nano)
**Outcome**: `src/monthly-analysis/agents/normalization.ts` exporta `runNormalizationAgent(rawEntries, options)` que chama `callLlm({ task: "normalization", ... })`, devolve `NormalizedLedgerEntry[]` validado pelo schema. Prompt em `src/monthly-analysis/agents/prompts/normalization.ts` — instruções: limpar descrição, marcar `documentType`, NUNCA alterar `amountCents` ou `date`, listar `noiseFlags` quando aplicável.

**Files**:
- ADD `src/monthly-analysis/agents/normalization.ts`
- ADD `src/monthly-analysis/agents/prompts/normalization.ts`
- MODIFY `src/monthly-analysis/agents/index.ts` (re-export)
- ADD `tests/monthly-analysis/normalization-agent.test.ts` — mockar `callLlm`, validar schema parsing, validar invariantes (valor/data preservados)

**Acceptance**:
- ≥4 testes cobrindo: (a) schema válido passa, (b) schema inválido lança, (c) alteração de `amountCents` é detectada por guard pós-LLM, (d) entradas vazias retornam `[]` sem chamar LLM
- `noiseFlags` documentadas: pelo menos `["duplicate_suspect", "unknown_counterparty", "rounded_value"]`

**Deps**: 3.A.1 (não bloqueante na verdade, mas mantém ordem mental).

---

## Wave 3.B — Agentes restantes

### Task 3.B.1 — Agente `narrative-synthesis` (LLM gemini-2.5-flash)
**Outcome**: `src/monthly-analysis/agents/narrative-synthesis.ts` exporta `runNarrativeSynthesisAgent(input, options)` que recebe `{ dre, anomalies, marginDiagnosis, cashflowRisk }`, gera **exatamente 3 cards** validados por `NarrativeCardDraftSchema`. Cada card: 1 critical_gap + 1 attention + 1 healthy (regra refinement no schema — adicionar refine() se ainda não existir). `evidenceRefs[]` deve referenciar métrica do DRE ou code de anomalia/diagnóstico.

**Files**:
- ADD `src/monthly-analysis/agents/narrative-synthesis.ts`
- ADD `src/monthly-analysis/agents/prompts/narrative-synthesis.ts` — reaproveitar princípios já refinados em `src/dre-narrative/prompts.ts` (verbos proibidos/exigidos, jargão por taxRegime, evidência numérica)
- MODIFY `src/monthly-analysis/schemas/agents.ts` — adicionar refine() pra "exatamente 3 cards, um de cada tipo" se ainda não existir
- MODIFY `src/monthly-analysis/agents/index.ts`
- ADD `tests/monthly-analysis/narrative-synthesis-agent.test.ts`

**Acceptance**:
- Teste schema rejeita output com 2 ou 4 cards
- Teste schema rejeita output com 2 cards do mesmo tipo
- Teste com `dre` healthy gera ao menos 1 card `healthy`

**Deps**: nenhuma (agente é isolado).

---

### Task 3.B.2 — Agente `action-planning` (LLM gemini-2.5-flash + thinkingBudget)
**Outcome**: `src/monthly-analysis/agents/action-planning.ts` exporta `runActionPlanningAgent(input, options)`. Reusar `ActionPlanDraftSchema` (já tem refine() para ≥3 short + ≥1 medium + ≥1 long). Cada ação precisa `doneWhen`, `evidenceRefs`, `confidence`, `impactCents`. Prompt deve forçar referência a métrica/anomalia/diagnóstico via `evidenceRefs`.

**Files**:
- ADD `src/monthly-analysis/agents/action-planning.ts`
- ADD `src/monthly-analysis/agents/prompts/action-planning.ts` — reaproveitar `src/action-plan/prompts.ts`
- MODIFY `src/monthly-analysis/agents/index.ts`
- ADD `tests/monthly-analysis/action-planning-agent.test.ts`

**Acceptance**:
- Schema refusa <3 short / <1 medium / <1 long (já garantido pelo schema)
- Teste valida que mock LLM retornando ação sem `doneWhen` falha parsing
- Teste valida que `evidenceRefs` vazio falha

**Deps**: nenhuma.

---

## Wave 3.C — Orquestração

### Task 3.C.1 — Nós LangGraph para os agentes existentes + paralelismo
**Outcome**: criar nós em `src/monthly-analysis/graph/nodes/` que envelopam cada agente — um nó por agente. Edges:

```
load_analysis → normalize → clarity_judge → dre_classifier → aggregate_dre
  → parallel(anomaly_detection, margin_diagnosis, cashflow_risk)
  → narrative_synthesis → action_planning
  → finalize
```

`aggregate_dre` reusa `src/dre-narrative/aggregator.ts` (não-LLM, determinístico).

**Files**:
- ADD `src/monthly-analysis/graph/nodes/normalize.ts`
- ADD `src/monthly-analysis/graph/nodes/clarity-judge.ts`
- ADD `src/monthly-analysis/graph/nodes/dre-classifier.ts`
- ADD `src/monthly-analysis/graph/nodes/aggregate-dre.ts`
- ADD `src/monthly-analysis/graph/nodes/anomaly-detection.ts`
- ADD `src/monthly-analysis/graph/nodes/margin-diagnosis.ts`
- ADD `src/monthly-analysis/graph/nodes/cashflow-risk.ts`
- ADD `src/monthly-analysis/graph/nodes/narrative-synthesis.ts`
- ADD `src/monthly-analysis/graph/nodes/action-planning.ts`
- MODIFY `src/monthly-analysis/graph/index.ts` — wire all nodes + edges + parallel fan-out using LangGraph's `addConditionalEdges` ou pattern de map-reduce
- ADD `tests/monthly-analysis/graph-orchestration.test.ts` — happy path E2E com agentes LLM mockados, valida ordem de execução via `state.traces[].agent`

**Acceptance**:
- E2E test invoca grafo com fixture de 20 lançamentos mockados → produz `state` com `narrativeCards.length === 3` e `actionPlan.actions.length ≥ 5`
- Ordem de traces respeita o grafo (normalize antes de classifier, diagnosis antes de narrative, etc.)
- Paralelismo confirmado: anomaly/margin/cashflow têm timestamps sobrepostos no trace

**Deps**: 3.A.1, 3.A.2, 3.B.1, 3.B.2.

---

### Task 3.C.2 — Instrumentação Langfuse por nó (C6 hard gate)
**Outcome**: cada nó que chama LLM envelopa `callLlm` em `observe()` (`src/observability/langfuse.ts` ou wrapper equivalente já existente). Cada agente persiste `AgentCost` em `state.costs` e `AgentTrace` em `state.traces`. `finalize` envia trace consolidado pro Langfuse com `name="monthly-analysis-graph"`.

**Files**:
- MODIFY todos os nós LLM da 3.C.1 — adicionar instrumentação
- MODIFY `src/monthly-analysis/graph/nodes/finalize.ts` — emitir trace pai
- ADD `tests/monthly-analysis/graph-telemetry.test.ts` — mockar Langfuse, assert que cada nó LLM emitiu span com fields `tenantId`, `analysisId`, `task`, `costCents`

**Acceptance**:
- Grep `callLlm` em `src/monthly-analysis/graph/nodes/` retorna **zero** ocorrências sem `observe()` ao redor (regex de pre-merge-check G3 passa)
- `state.costs.length === número de nós LLM executados`

**Deps**: 3.C.1.

---

## Wave 3.D — SHADOW runner

### Task 3.D.1 — CLI runner pra SHADOW comparison
**Outcome**: `scripts/run-monthly-analysis-graph-shadow.ts` — invoca o grafo contra um `analysisId` real (já processado pelo BullMQ legacy), persiste resultado em `state` JSON em `evals/monthly-analysis/shadow-runs/{date}-{analysisId}.json`, NÃO escreve nos modelos Prisma de produção. Cria também relatório markdown comparando: classificação legacy × agentic (% match), narrativa legacy × agentic (diff de cards), plan legacy × agentic (cobertura de horizons).

**Files**:
- ADD `scripts/run-monthly-analysis-graph-shadow.ts`
- ADD `package.json` script: `"shadow:graph": "tsx --env-file=.env scripts/run-monthly-analysis-graph-shadow.ts"`
- ADD `docs/monthly-analysis/shadow-runs/README.md` explicando uso
- ADD `evals/monthly-analysis/shadow-runs/.gitkeep`

**Acceptance**:
- Comando `npm run shadow:graph -- --analysisId=<seu_test_id>` roda sem erro e gera arquivo em `evals/monthly-analysis/shadow-runs/`
- Relatório markdown gerado tem 3 seções (classification diff, narrative diff, plan diff) com % numérico

**Deps**: 3.C.1, 3.C.2.

---

## Wave 5 — QA gate

### Task 5.A.1 — Agente `financial-qa-review` (LLM gpt-4.1-mini)
**Outcome**: `src/monthly-analysis/agents/financial-qa-review.ts` exporta `runFinancialQaReviewAgent(state, options)` que recebe `MonthlyAnalysisState` completo (com narrativeCards + actionPlan + dre + anomalies), valida com `QaReviewSchema`. Detecta: número errado em cards/plano vs DRE, ação sem `doneWhen`, narrativa contradiz diagnóstico, plano de ação não cita evidência presente nas anomalias.

**Files**:
- ADD `src/monthly-analysis/agents/financial-qa-review.ts`
- ADD `src/monthly-analysis/agents/prompts/financial-qa-review.ts`
- MODIFY `src/monthly-analysis/agents/index.ts`
- ADD `tests/monthly-analysis/financial-qa-review-agent.test.ts`

**Acceptance**:
- Teste: state com narrativa citando margem bruta errada → QA retorna `publishable: false` + issue `severity: blocker`
- Teste: state com action sem `doneWhen` → QA retorna `severity: blocker`
- Teste: state limpo → `publishable: true, issues: []`

**Deps**: 3.B.1, 3.B.2.

---

### Task 5.A.2 — Conditional retry + needs_review
**Outcome**: adicionar nó `qa_gate` ao grafo. Lógica condicional pós-QA:
- `publishable: true` → vai pra `finalize`
- `publishable: false` AND `retryTargets` não vazio AND ainda não tentou retry → re-executar nós listados (`narrative-synthesis` e/ou `action-planning`) **uma vez**
- Após 1 retry sem sucesso ou se `retryTargets` vazio → marca `state.needsReview = true` e vai pra `finalize`

**Files**:
- ADD `src/monthly-analysis/graph/nodes/qa-review.ts`
- ADD `src/monthly-analysis/graph/nodes/qa-gate.ts` (router condicional)
- MODIFY `src/monthly-analysis/graph/state.ts` — adicionar `needsReview?: boolean` e `retryCount?: { narrative: number, actionPlan: number }`
- MODIFY `src/monthly-analysis/graph/index.ts` — adicionar nós + edges condicionais
- ADD `tests/monthly-analysis/graph-qa-retry.test.ts` — 3 cenários: publishable, retry resolveu, retry não resolveu (needsReview)

**Acceptance**:
- Test cenário 1: QA aprovou → `state.needsReview === undefined`, finalize executou
- Test cenário 2: QA bloqueou narrativa, retry resolveu → `state.retryCount.narrative === 1`, `state.needsReview === undefined`
- Test cenário 3: QA bloqueou e retry também → `state.needsReview === true`, finalize executou mesmo assim

**Deps**: 5.A.1, 3.C.1.

---

## Cross-cutting — não esquecer

### Eval seeds (paralelo, pode ir em PR separado a qualquer momento)

Cada agente novo precisa de pasta `evals/monthly-analysis/{agent}/cases/` com ≥10 cases iniciais. Pacote mínimo do plano:

| Agente | Cases mínimos | Método de eval |
|---|---|---|
| normalization | 10 | `schema_validation` + `assertion_shape` |
| narrative-synthesis | 15 | `llm_as_judge` (reusar runner da PR #1 → 81eebc4) |
| action-planning | 15 | `llm_as_judge` + schema |
| financial-qa-review | 10 adversariais (plantar erros) | `assertion_shape` |

Não bloqueia merge das tasks — pode ir em onda separada. Mas sem isso, `/acme:promote` pra ASSISTED bloqueia (Gate 4).

### Pre-merge-check (sempre)

Cada PR desta sequência deve passar:
- G1 C7: zero `import` de SDK fora de `src/llm/adapters/`
- G2 C8: zero `tenantId === '...'` em `src/monthly-analysis/`
- G3 C6: zero `callLlm` sem `observe()` em volta nos nós do grafo
- Testes verdes, typecheck clean

### Naming PRs

`feat(monthly-analysis): <descrição>` — ⚠️ atenção: `monthly-analysis` **não está** na lista de module keys do `CLAUDE.md`. Decisão pendente: incluir ou usar key de submódulo (ex: `dre-narrative`). Por ora, manter `feat(monthly-analysis):` e tratar o sync ClickUp como follow-up à parte.

### Não usar `--delete-branch` em PR que tem cascata

Lição cara aprendida em 2026-05-20: GitHub auto-fecha PRs filhos quando a base deixa de existir, e PR fechado não permite mudar base. Antes de mergear PR base, **reapontar PRs filhos pra main** via `gh pr edit <n> --base main`.

---

## Ordem de execução sugerida

```
Wave 3.A (skeleton + normalization)
   ├── 3.A.1 → PR independente, base p/ 3.A.2
   └── 3.A.2 → PR independente

Wave 3.B (agentes restantes) — paralelizável
   ├── 3.B.1 → PR independente
   └── 3.B.2 → PR independente

Wave 3.C (orquestração) — depende de 3.A + 3.B
   ├── 3.C.1 → 1 PR
   └── 3.C.2 → 1 PR (telemetry C6)

Wave 3.D (SHADOW)
   └── 3.D.1 → 1 PR

Wave 5 (QA gate)
   ├── 5.A.1 → 1 PR (agente)
   └── 5.A.2 → 1 PR (retry/needsReview)
```

**Total**: 9 PRs. Pode ser paralelizado em 3-4 ondas de PR concorrentes (3.A.1 ‖ 3.A.2; 3.B.1 ‖ 3.B.2; 3.C.1 → 3.C.2 → 3.D.1; 5.A.1 → 5.A.2). Hermes Agent já demonstrou velocidade de ~4 PRs/noite — viável em 2-3 noites.

## Definition of done desta onda

- [ ] `npm run shadow:graph -- --analysisId=<test>` roda end-to-end produzindo arquivo em `evals/monthly-analysis/shadow-runs/`
- [ ] Relatório SHADOW mostra diff legacy × agentic em 3 dimensões
- [ ] Todas as 6 gates pre-merge-check passam em todos os 9 PRs
- [ ] `npm test` ≥ 160 testes verdes (atual: 131 + ~30 estimados)
- [ ] Custo medido por análise no Langfuse documentado em `docs/monthly-analysis/shadow-cost-baseline.md` — atualizar projeção R$ 0,44 com dados reais
- [ ] CEO ciente do estado: agentic em SHADOW, BullMQ em prod
- [ ] Decisão registrada em ADR (criar `docs/adr/008-langgraph-mvp.md`) sobre coexistência com BullMQ até promoção pra ASSISTED

---

## O que esta onda NÃO entrega (por design)

- Substituição do BullMQ legacy — fica pra próxima decisão (post-SHADOW)
- Avaliação de qualidade ASSISTED-ready — fica nos evals (Gate 4 do `/acme:promote`)
- LGPD (Vertex AI) — pendência paralela, não-bloqueante pra SHADOW interno

Quando todas as 8 tasks acima estiverem mergeadas + SHADOW reportando dados, a próxima decisão de produto é: **promover monthly-analysis agentic pra default ou rollback?**
