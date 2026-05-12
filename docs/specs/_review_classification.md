---
module_key: "classification"
module_name: "Classification — Categorização DRE"
wave: 1
tier: "B"
review_type: "review"
created_at: "2026-05-12"
reviewer: "review_agent"
---

# Review — classification

> Revisão consolidada do módulo `classification` (Onda 1, Tier B) contra a spec aprovada e os 8 princípios da Constitution Forge v0.2.0.
> Fontes lidas: `docs/specs/classification.md`, `docs/specs/_backend_classification.md`, `docs/specs/_frontend_classification.md`, `docs/specs/_tests_classification.md`.

---

## BLOCKERS (impede merge)

- [BLOCKER] **Outcome `taxonomy_drift_detected` declarado na spec (linha 21 de `classification.md`) sem implementação no backend.** `_backend_classification.md` não menciona drift detector; `classifier.ts` não emite sinal/evento para padrões recorrentes sem categoria. Spec exige 3 outcomes; backend entrega apenas 2 (`ledger_classified`, `classification_confidence_low`). Critério de pronto da spec NÃO é satisfeito. Ação: implementar detector ou abrir ADR removendo o outcome da spec.

- [BLOCKER] **TEST-DRIFT confirmado em `classifier.ts:109` — `enqueueDreNarrative` é chamado mesmo quando `entries.length === 0`.** O `if (entries.length === 0)` na linha 29-32 apenas loga warn e dá `return`, MAS o return acontece antes do enqueue (correção parcial). Releitura: o return na linha 31 está dentro do `if`, então sai antes. **Reclassificado para WARNING** após releitura do código — ver abaixo.

- [BLOCKER] **Contrato frontend (`_frontend_classification.md`) declara paginação cursor-based em `GET /classification/:analysisId/review` com `meta: { total, cursor, hasMore, requestId }`, mas a rota implementada em `src/classification/routes.ts:17-51` retorna `array` puro sem paginação nem `meta`.** O response schema em `routes.ts:20-32` é `z.array(...)`, não o `{ data, meta }` do contrato OpenAPI. Quebra de contrato impede o frontend de implementar conforme handoff. Ação: alinhar route ao contrato (preferível) ou abrir PR atualizando o contrato com justificativa.

- [BLOCKER] **Contrato declara respostas de erro RFC 7807 (`application/problem+json` com `type/title/status/detail/instance/requestId`), mas a rota retorna `{ message: "Lançamento não encontrado" }` (`routes.ts:68`).** Frontend foi instruído a parsear ProblemDetails — vai quebrar. Ação: implementar error handler global RFC 7807 ou ajustar contrato.

- [BLOCKER] **C4 (SHADOW antes de cobrar) NÃO é respeitado nas mutações.** PATCH `/classification/entries/:entryId/correct` aplica `confirmedCategory` diretamente independente do modo da subscription (SHADOW/ASSISTED/AUTONOMOUS). Em SHADOW, mutações do cliente não deveriam afetar o estado entregue (apenas alimentar telemetria/flywheel). Não há leitura de `subscription.mode` em lugar algum do módulo. Spec e backend doc não mencionam tratamento de modo. Ação: bloquear ou marcar shadow as mutações conforme modo do tenant antes do merge.

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **Spec é stub (`status: "stub"` em `classification.md`)** — não há cláusula formal de outcome (C2), nem eval suite mínima (≥10 casos por outcome), nem unit economics (C3), nem riscos. Spec stub não cumpre o critério de pronto formal definido no header da própria spec. Rodar `/acme:spec --module classification` antes de promover.

- [WARNING] **TEST-DRIFT — `enqueueDreNarrative` é chamado mesmo com 0 entradas a classificar.** Releitura confirma que o `return` na linha 31 sai antes do enqueue na linha 109. Asserção do teste "sem entradas → NÃO enfileira dre-narrative" está CORRETA. Porém, o `findMany` da linha 23 filtra por `predictedCategory: null`, então em re-runs com tudo já classificado o enqueue NÃO acontece. **OK em runtime**, mas o teste `_tests_classification.md` linha 421-425 marca isso como TEST-DRIFT — recomendo manter a asserção do teste (segue a spec) e documentar que o early return cobre o caso.

- [WARNING] **`GET /classification/:analysisId/review` não verifica existência/posse da análise (`analysisId`) antes do `findMany`.** Se `analysisId` não existir ou pertencer a outro tenant, retorna array vazio com 200 (em vez de 404/403 conforme contrato). C8 está preservado (não vaza dados), mas o contrato (`_frontend_classification.md`) declara 403/404 explícitos. Frontend não tem como diferenciar "análise vazia" de "análise inacessível".

- [WARNING] **`source: "rafael"` é aceito em PATCH público sem verificação de papel/permissão.** Cliente autenticado pode enviar `source: "rafael"` e poluir o flywheel marcando correção própria como interna. Adicionar guard: se `req.auth.role !== "internal"`, forçar `source = "client"`.

- [WARNING] **Resposta `GET /review` não inclui `requestId` para correlação com logs/Langfuse (C6).** Contrato exige `meta.requestId`; rota não emite. Sem correlação, debug de incidentes de classificação fica frágil.

- [WARNING] **`callLlm` recebe `tenantId` (`classifier.ts:58`), mas não passa `traceId` nem `metadata.analysisId`** — a trace Langfuse não fica vinculada ao analysisId, dificultando auditoria de outcome individual (C6). `src/llm/index.ts:14-19` aceita `req.traceId` mas o classifier não envia.

- [WARNING] **Worker BullMQ com concorrência 3 mencionado em `_backend_classification.md` não tem teste de back-pressure / retry policy no `_tests_classification.md`.** Gap explicitamente reconhecido no Gaps do test doc, mas relevante para produção (C3 — custo de retry mal calibrado quebra unit economics).

- [WARNING] **`predictedCategory: null` no contrato/handoff (linhas 119, 261 de `_frontend_classification.md`) — mas em runtime o backend só seta `null` se `findMany` filtrar entries não-classificadas E o batch falhar antes do update.** Na implementação atual (`classifier.ts:66-70`) batch falho seta `predictedCategory: "nao_classificado"`, não `null`. Contrato promete shape que o backend NÃO produz. Ajustar contrato OU comportamento.

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] Extrair `LOW_CONFIDENCE_THRESHOLD = 0.7` para `tenant-config` ou `aios/agents/classification/config.yml` — permite ajuste por SKU/tier sem rebuild (C7 — portability).

- [SUGGESTION] `buildSystemPrompt` poderia incluir hash de versão (`PROMPT_VERSION = "1.0.0"`) emitido como metadata em `callLlm` — facilita auditoria mensal de drift via `/acme:audit-monthly`.

- [SUGGESTION] Adicionar índice composto `(tenantId, analysisId, correctionSource)` em `LedgerEntry` no Prisma schema para acelerar `GET /review` em análises grandes.

- [SUGGESTION] `BATCH_SIZE = 20` hardcoded — vale testar 30-50 para reduzir nº de chamadas LLM e aproveitar prompt cache do Gemini. Documentar a decisão em ADR (C3).

- [SUGGESTION] Logar `costCents` agregado por `analysisId` ao final de `classifyAnalysis` — útil para validação contínua de C3 (custo ≤ 25% do preço).

- [SUGGESTION] `routes.ts:9` usa `z.enum(DRE_CATEGORIES as [string, ...string[]])` — cast pode ser substituído por `z.enum(DRE_CATEGORIES)` direto, mantendo type safety estrito (regra do projeto contra cast).

## Checklist resumido

| Item | Status |
|---|---|
| Spec compliance — entidades implementadas | Parcial (sem drift detector) |
| Spec compliance — regras testadas | Sim (test suite robusta) |
| Spec compliance — edge cases | Sim (boundary, batch fail, JSON inválido) |
| Spec compliance — critério de pronto | NÃO (outcome faltante + spec stub) |
| C8 multi-tenancy via tenantId | Sim (route + integration test) |
| C8 sem hardcode de tenant | Sim (taxonomia única) |
| C7 SYSTEM_PROMPT funciona sem kernel AIOS | Sim (`buildSystemPrompt` puro) |
| C6 chamadas LLM com trace | Sim via `callLlm` wrapper |
| C5 isolamento L0/L1/L2 | Sim (system prompt L0, user L1+L2) |
| C4 SHADOW antes de cobrar | **NÃO** (mutação não respeita modo) |
| C3 unit economics | Não auditável (spec sem UE) |
| Validação de input em rotas | Sim (Zod) |
| Respostas de erro padronizadas | **NÃO** (não-RFC7807) |
| Sem lógica de negócio no controller | Sim |
| TEST-DRIFTs reportados | Sim (1 confirmado como WARNING) |

## APROVADO PARA MERGE: Não
