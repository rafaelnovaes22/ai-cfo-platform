---
module_key: "dre-narrative"
module_name: "DRE Narrative — Narrador da DRE"
wave: 1
tier: "B"
review_status: "blocked"
constitution_version: "0.2.0"
backend_commit: "cab4d85"
reviewed_at: "2026-05-12"
reviewed_by: "Review Agent (Aicfo/AIOS)"
artifacts_reviewed:
  - "docs/specs/dre-narrative.md"
  - "docs/specs/_backend_dre-narrative.md"
  - "docs/specs/_frontend_dre-narrative.md"
  - "docs/specs/_tests_dre-narrative.md"
---

# Review — dre-narrative

> Revisão consolidada do módulo `dre-narrative` (Onda 1, Tier B) contra a spec canônica e os 8 princípios da Constitution Forge. Atenção especial aos 26 marcadores TEST-DRIFT/SPEC-INFERRED do `_tests_dre-narrative.md`, classificados abaixo como BLOCKER ou WARNING.

---

## BLOCKERS (impede merge)

- [BLOCKER] **Spec canônica ainda em status `stub`** — `docs/specs/dre-narrative.md` linha 6 declara `status: "stub"` e linha 31 explicita "spec detalhada será gerada via `/acme:spec --module dre-narrative` quando este módulo entrar em desenvolvimento". O módulo já está implementado (commit `cab4d85`) e revisado, mas sem cláusula de outcome literal (C2), eval suite mínima ≥10 casos por outcome (C3/C6), unit economics e configuração por tenant (C8) declarados na spec. Sem spec aprovada não há contrato verificável — auditor externo (DeepAgent) não consegue validar drift.
- [BLOCKER] **Outcome `anomaly_flagged` declarado mas não implementado no backend** — `docs/specs/dre-narrative.md` linha 21 declara `anomaly_flagged: variação >X% vs. mês anterior gera card de gargalo`. Backend (`src/dre-narrative/narrator.ts` segundo `_backend_dre-narrative.md`) só lê o mês corrente; não há query de `MonthlyAnalysis` do mês anterior nem comparação MoM. Confirmado por `_tests_dre-narrative.md` linhas 878-894 (`anomaly.test.ts` inteiro está `.skip` com tag `[TEST-DRIFT]`) e Gap #1 (linha 946). Outcome cobrável declarado sem implementação viola C2 (outcome-first).
- [BLOCKER] **C6 violado — `langfuseTraceId` recebe `costCents.toString()` em vez do trace ID real** — `_tests_dre-narrative.md` linhas 549-565 reportam o bug explicitamente: backend grava `llmResponse.costCents.toString()` no campo `langfuseTraceId` da `MonthlyAnalysis`. Campo é trace ID, não custo monetário. Sem trace Langfuse correto, chamada LLM não é auditável → viola Constitution C6 (Telemetry-by-default obrigatório) e quebra contrato com DeepAgent reviewer. Teste positivo está `.skip` aguardando correção.
- [BLOCKER] **C4 violado — PATCH `/feedback` aceita qualquer `subscriptionMode`** — `_tests_dre-narrative.md` linhas 739-761 (dois testes `.skip` `[TEST-DRIFT]`) reportam que o backend não verifica `subscriptionMode` no preHandler. Frontend handoff (`_frontend_dre-narrative.md` linha 380-384) e contract OpenAPI declaram: "Disponível apenas em modo ASSISTED. (...) Em modo AUTONOMOUS ou SHADOW, a chamada retorna 200 mas o campo pode ser ignorado". Comportamento implementado contraria o contrato exposto ao frontend e viola C4 (modos têm semântica diferente — SHADOW não deve receber input do cliente).
- [BLOCKER] **C4 violado — GET `/narrative` expõe cards em status `ready` (SHADOW)** — `_tests_dre-narrative.md` linhas 671-682 reportam `[TEST-DRIFT]`: backend não filtra por `status`/`mode` no GET de cards. Em SHADOW, análise deve ser gerada mas NÃO entregue ao cliente (definição C4 da CLAUDE.md). Status `ready` em SHADOW = revisão humana pendente; expor cards quebra a separação SHADOW vs ASSISTED/AUTONOMOUS, violando o princípio da promoção gradual de modo.
- [BLOCKER] **Eval suite ≥10 casos por outcome não existe** — Gap #3 do `_tests_dre-narrative.md` (linha 948) confirma: não há `evals/dre-narrative/cases/*.json`. Spec template Forge exige eval suite versionada por outcome (`dre_aggregated`, `narrative_generated`, `anomaly_flagged`). Sem ela, `/acme:eval` não roda e promoção SHADOW→ASSISTED bloqueia em `/acme:promote` (gate de "eval suite passing"). Bloqueante para promoção, portanto bloqueante para merge na Onda 1.
- [BLOCKER] **Threshold X% da anomalia não fixado na spec** — Gap #2 (`_tests_dre-narrative.md` linha 947): spec diz "variação >X% vs. mês anterior" sem declarar X. Sem número canônico, impossível escrever assert determinístico, eval case ou comportamento testável. Necessário fixar (sugestão dos testes: 30% MoM) antes de implementar `anomaly_flagged`.
- [BLOCKER] **Cláusula de outcome literal (C2) ausente** — Gap #8 (`_tests_dre-narrative.md` linha 953): spec stub não declara cláusula de outcome literal nem SLA (ex: "DRE com 31 linhas + 3 cards entregues em <120s p95"). C2 exige outcome-first com critério mensurável. Sem isso, não há base para `/acme:sla-threshold` nem para auditoria mensal.

---

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **Spec canônica não declara as 31 linhas da `DreLines`** — Backend e contract documentam estrutura DreLines de 31 chaves (`receitaBruta`...`naoClassificado`), com regras contábeis precisas (Receita Líquida = Bruta − Deduções, EBITDA = Lucro Bruto − Total Despesas Op, etc.). Essa estrutura é regra de negócio canônica do produto, deveria estar na spec, não inferida do código. Marcado como `SPEC-INFERRED` em múltiplos pontos do test file.
- [WARNING] **Precedência `confirmedCategory > predictedCategory` é SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 177-201 testam regra crítica (cliente que reclassifica uma transação deve ver o resultado refletido na DRE) mas marcada como SPEC-INFERRED. Regra deveria estar explícita na spec para servir como contrato com Classification module.
- [WARNING] **Tratamento de divisão por zero nas margens não está na spec** — `_tests_dre-narrative.md` linha 224-232: backend faz fallback para 0 quando `receitaLiquida = 0`. Comportamento correto, mas regra ausente da spec (SPEC-INFERRED). Em UX, mostrar `0%` quando não há receita pode confundir; spec precisa declarar política.
- [WARNING] **Idempotência de re-geração SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 525-538: backend faz `deleteMany` antes de `createMany` em transação. Política de re-geração (sobrescrita silenciosa vs versionamento) precisa ser explícita na spec — relevante para auditoria.
- [WARNING] **Snapshot `dreJson`/`narrativeJson` em `MonthlyAnalysis` SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 450-481: backend salva snapshots para export/audit. Boa prática, mas não declarada na spec. Relevante para módulo `export` e governança.
- [WARNING] **Acúmulo de `costCents` SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 470-481: `costCents` é acumulado entre etapas do pipeline (classification + dre-narrative + action-plan). Crítico para C3 (custo ≤25% do preço) mas regra não está na spec. Sem isso, não é possível auditar mensalmente se cada análise respeita unit economics.
- [WARNING] **`toneOfVoice` e defaults SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 483-523: backend usa `productConfig.monthlyAnalysis.toneOfVoice` com default `"formal"`. Configuração por tenant (C8) deveria estar declarada na spec, incluindo enum de valores válidos (`formal`, `informal`, `direto`, etc).
- [WARNING] **PII guard (não vazar `tenantId` no userPrompt) SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 513-522: teste negativo válido (`tenantId` só na meta da call, não no prompt), mas regra de PII precisa estar explícita na spec/Constitution para ser auditada.
- [WARNING] **Regra "margem líquida <5% → atenção/crítico" só no system prompt** — `_tests_dre-narrative.md` linhas 814-816: regra de negócio embutida em prompt L0, não declarada na spec. Difícil auditar drift quando regra vive em prompt — precisa estar em `spec.business_rules` ou similar.
- [WARNING] **Regra "pessoal+prolabore > 40% receita líquida → atenção"** — Gap #9 (linha 954): regra no prompt mas testada só por presença de string. Comportamento real é território de eval suite (semantic_match / llm_as_judge). Sem eval suite (BLOCKER acima), regra fica sem cobertura efetiva.
- [WARNING] **Política de retry em falha de parse JSON do LLM** — Gap #10 (linha 955): backend hoje lança erro direto. Spec não declara retry policy. Para módulo Tier B em pipeline crítico, ausência de retry pode degradar SLA.
- [WARNING] **`anomaly.test.ts` inteiro `.skip` sem issue de backend rastreável** — `_tests_dre-narrative.md` Gap #1 sugere "abrir issue de backend antes de habilitar os testes". Sem issue tracker linkado, o teste skip vira dívida técnica invisível ao auditor mensal.
- [WARNING] **Encadeamento `enqueueActionPlan` SPEC-INFERRED** — `_tests_dre-narrative.md` linhas 429-447: pipeline product-vision (narrator → action-plan) implementado mas a regra "dre-narrative encadeia action-plan ao final" não está formalizada na spec dre-narrative nem em ADR. Mudanças em qualquer módulo do pipeline ficam frágeis.
- [WARNING] **Edge case "naoClassificado > 0" não tem política de UX/UI canônica** — `_frontend_dre-narrative.md` linha 919 sugere "Exibir nota explicativa", mas é sugestão do contract agent, não decisão de produto. Pode gerar inconsistência se backend mudar a semântica de `naoClassificado`.
- [WARNING] **Polling a 10s e timeout 8s no frontend** — `_frontend_dre-narrative.md` linhas 914, 927: valores sugeridos pelo Contract Agent, não decididos em ADR. Sem SLA pré-contratada (C4 — Gate `/acme:sla-threshold`), esses valores podem violar custo de chamada (volume × tempo) ou frustrar UX.

---

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] Adicionar campo `modelVersion` (ex: `gemini-2.5-flash-2026-04`) no snapshot `narrativeJson` para facilitar drift audit e rollback quando trocar de modelo.
- [SUGGESTION] Documentar no handoff frontend a expectativa de `requestId` ser correlacionável com `langfuseTraceId` — útil para suporte rastrear sessão fim-a-fim.
- [SUGGESTION] Considerar versionamento de `evidence` (ex: schema versionado) — métricas e unidades podem evoluir; export histórico precisa saber qual schema usar.
- [SUGGESTION] Tests `prompts.test.ts` validam presença de strings no system prompt. Considerar gerar hash do prompt L0 e fixar em snapshot — mudanças não-intencionais no prompt cacheável seriam detectadas.
- [SUGGESTION] Adicionar teste de regressão para garantir que `Object.keys(dre).length === 31` (já existe) também valide ordem canônica, facilitando comparação de snapshots no export.
- [SUGGESTION] Considerar mover regras de negócio embutidas no system prompt (margem líquida <5%, pessoal+prolabore >40%) para uma seção `business_rules` na spec — permite eval cases automatizados e auditoria de drift de regra.
- [SUGGESTION] Backend salva `dreJson` como JSONB. Sugerir índice GIN para consultas de export agregado por tenant (relevante quando `hub`/`export` escalar).

---

## Resumo executivo

- **BLOCKERs (8)**: spec stub, `anomaly_flagged` sem implementação, bug C6 `langfuseTraceId`, C4 PATCH sem checagem de modo, C4 GET expondo SHADOW, eval suite ausente, threshold X% indefinido, cláusula de outcome ausente.
- **WARNINGs (15)**: cobrem todos os 26 marcadores TEST-DRIFT/SPEC-INFERRED que não viraram BLOCKER e gaps de governança (regras só em prompt, configs sem ADR, retry policy ausente).
- **Constitution status**: C6 e C4 violados (BLOCKERs). C8 parcialmente OK no código (multi-tenancy via `tenantId` confirmado em `routes.test.ts`) mas regras de tenant não declaradas em spec. C2 falha (sem cláusula de outcome). C3 não verificável (sem eval/unit economics). C5/C7 OK no nível de código (system prompt L0 cacheável + abstração `callLlm` confirmados pelos testes).
- **Engenharia**: validação Zod em rotas pública OK (testes confirmam rejeição de `comment > 500`). Multi-tenancy hard isolation OK (`req.auth.tenantId` usado, query string `tenantId` rejeitada). Bug C6 e ausência de checagem C4 são mecânicos e corrigíveis em poucas linhas; ausência de spec/eval é trabalho estrutural.

## APROVADO PARA MERGE: Não
