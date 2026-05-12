# Review — action-plan

**Reviewer:** Review Agent (Forge)
**Data:** 2026-05-12
**Spec:** `docs/specs/action-plan.md` (status: `stub`, constitution_version 0.2.0)
**Backend doc:** `docs/specs/_backend_action-plan.md` (commit 4d5862a, complete)
**Frontend doc:** `docs/specs/_frontend_action-plan.md`
**Tests doc:** `docs/specs/_tests_action-plan.md` (MODE: REINFORCE)

---

## BLOCKERS (impede merge)

- [BLOCKER] **Violação C4 — PATCH feedback aceito em modos AUTONOMOUS e SHADOW**: a spec/handoff declara explicitamente que o endpoint `PATCH /analysis/:id/action-plan/:itemId/feedback` é "disponível apenas no modo ASSISTED" (`_frontend_action-plan.md` linhas 297-304 e 697). O backend (`_backend_action-plan.md` linha 11) não menciona guard de modo, e os testes em `_tests_action-plan.md` linhas 382-419 marcam dois casos como TEST-DRIFT confirmando que o backend permite feedback em `autonomous` e `shadow`. C4 exige que o comportamento de cada modo seja respeitado mecanicamente — entregar feedback em SHADOW quebra a premissa de "análise não entregue ao cliente". Adicionar guard no handler que retorne 403/409 quando `req.auth.mode !== "assisted"`.

- [BLOCKER] **Divergência de modelo vs spec (impacto C3)**: spec declara "Sonnet 4.6 + Opus 4.7 como fallback decisional" (`action-plan.md` linha 15). Backend implementa com **Gemini 2.5 Flash + thinkingBudget 2048** (`_backend_action-plan.md` linha 18). Sem ADR documentando a troca, o unit economics da Onda 0 (que assume Sonnet/Opus pricing) fica inconsistente — C3 exige custo ≤ 25% do preço, e a fonte de verdade do custo mudou sem rastro. Abrir ADR de substituição de modelo OU atualizar a spec do módulo antes de promover SHADOW → ASSISTED.

- [BLOCKER] **Spec ainda em status `stub` sem cláusula de outcome C2**: `action-plan.md` linha 6 declara `status: "stub"` e linha 31-32 confirma "spec detalhada será gerada via `/acme:spec` quando este módulo entrar em desenvolvimento". O módulo já está em desenvolvimento completo (backend complete, testes prontos), mas a cláusula de outcome formal (C2 — outcome-first, cobrável, mensurável) nunca foi escrita. Sem cláusula contratual, não há agreement testável e a regra "action_executable" (impacto cobrável) fica sem definição operacional. Executar `/acme:spec --module action-plan` para promover a spec de `stub` para `final` antes do merge.

- [BLOCKER] **`action_executable` (doneWhen) não enforced — conflito spec vs schema**: outcome `action_executable` da spec exige que "cada ação tem critério de 'feita' mensurável" (`action-plan.md` linha 20). Backend marca `doneWhen` como `nullable` no contrato OpenAPI (`_frontend_action-plan.md` linha 108) e o schema do generator aceita `doneWhen` opcional (gap #1 em `_tests_action-plan.md` linha 644). Resultado: o backend pode persistir um plano sem `doneWhen` e ainda considerá-lo válido, violando o outcome literal da spec. Tornar `doneWhen` obrigatório no schema do generator e no schema de persistência, ou ajustar a spec.

- [BLOCKER] **Drift inter-camadas: `horizon` z.string() em routes vs z.enum() em generator**: gap #9 em `_tests_action-plan.md` linha 652 documenta que `ActionItemSchema` em `routes.ts` usa `z.string()` para horizon, enquanto `generator.ts` usa `z.enum(["short","medium","long"])`. Isso permite que um valor inválido de horizon escape pela camada HTTP e gere divergência entre dado persistido e dado serializado. Padronizar para `z.enum(["short","medium","long"])` nas duas camadas.

- [BLOCKER] **Retry esgotado pode persistir plano sem `long` — viola `plan_generated`**: gap documentado em `_tests_action-plan.md` linhas 202-224 (caso edge "retry esgotado"). Outcome `plan_generated` da spec exige ≥1 ação `long`. O retry roda apenas 1x; se a segunda resposta da LLM também não tiver `long`, o teste espera throw, mas o comportamento atual do backend (conforme TEST-DRIFT) permite passar pelo schema `min(5)` e persistir. Adicionar validação pós-retry: se mínimos por horizonte ainda não atendidos, lançar erro em vez de persistir.

---

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **9 marcadores TEST-DRIFT/SPEC-INFERRED em `_tests_action-plan.md`**: a suíte de testes carrega 9 gaps explicitamente reconhecidos (linhas 220-223, 382-401, 403-419, 644-652). Cada um indica que ou a spec está incompleta ou a implementação diverge dela. Reconciliar todos antes de promover para AUTONOMOUS.

- [WARNING] **C6 — instrumentação Langfuse não verificável**: gap #6 em `_tests_action-plan.md` linha 649 reporta que `generateActionPlan` chama `callLlm` mas não há `trace.start/end` explícito no arquivo. C6 exige telemetria em toda chamada LLM em `src/skus/**` ou módulos que façam inferência. Validar que `src/llm/index.js` instrumenta com Langfuse e que metadata `module: "action-plan"` chega ao trace; caso contrário, adicionar wrapper explícito em `generator.ts`.

- [WARNING] **Eval suite ≥10 casos por outcome ausente**: gap #3 em `_tests_action-plan.md` linha 646. Spec stub declarou eval mínima como TBD, e o módulo é Tier B (exige eval suite). Sem eval, promoção SHADOW → ASSISTED bloqueia por C4. Criar `evals/action-plan/cases/` com ≥10 casos cobrindo `plan_generated`, `action_executable`, `impact_total_calculated`.

- [WARNING] **Unit economics C3 não declarada**: gap #4 em `_tests_action-plan.md` linha 647. Sem `costCents` máximo por outcome declarado na spec, não há boundary testável de C3. Definir threshold (ex: 30 centavos/outcome) em `c4_thresholds` da spec.

- [WARNING] **TenantContext via header `x-tenant-id` em testes esconde forma real do auth**: `_tests_action-plan.md` linhas 287-290 mocka `requireAuth` lendo `x-tenant-id` do header. Em produção, tenantId vem do JWT claim (`_frontend_action-plan.md` linha 38). Risco: rota poderia aceitar header `x-tenant-id` em produção se middleware real for permissivo. Verificar que `requireAuth` real lê **apenas** do JWT e ignora headers.

- [WARNING] **Idempotência de `/approve` confia em estado prévio sem lock**: caso "double-submit concorrente" (`_tests_action-plan.md` linha 509) só passa porque o mock serializa as escritas. Em PostgreSQL real, sem `SELECT ... FOR UPDATE` ou cláusula `WHERE status != 'approved'` no UPDATE, duas requests simultâneas podem ambas executar `update` e sobrescrever `approvedAt`. Validar com integration test ou adicionar guard no SQL.

- [WARNING] **Configuração por tenant (C8) limitada a `toneOfVoice`**: gap #5 em `_tests_action-plan.md` linha 648. Não há outros toggles testados — segmento, regime tributário, etc. Para módulo Tier B com 60 features mapeadas, ampliar `productConfig` lido pelo generator.

---

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] Expor `costCents` (custo da chamada LLM) na resposta de `GET /action-plan` em modo SHADOW para facilitar auditoria de C3 durante shadow runs.

- [SUGGESTION] Adicionar log estruturado (Pino) com `analysisId`, `tenantId`, `retryCount`, `actionsGenerated` ao final de cada `generateActionPlan` para troubleshooting em produção.

- [SUGGESTION] Considerar campo `confidence` por ação (low/medium/high) para que o frontend possa destacar ações de baixa confiança em ASSISTED — útil para reduzir fricção de aprovação.

- [SUGGESTION] Documentar no handoff (estados de UI) o caso "modo SHADOW" — atualmente o handoff só descreve ASSISTED e AUTONOMOUS implicitamente.

- [SUGGESTION] No worker BullMQ, expor concorrência 2 como env var (`ACTION_PLAN_WORKER_CONCURRENCY`) para tuning sem recompilar.

- [SUGGESTION] `_tests_action-plan.md` linha 644 lista 9 gaps na própria suíte — adicionar comentário no topo do `tests.md` apontando para esta seção e rastrear cada gap como issue no ClickUp.

---

## APROVADO PARA MERGE: Não