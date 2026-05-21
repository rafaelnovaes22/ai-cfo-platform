---
# Agent Memory — Aicfo (consumer Forge)
# Carregado no slot #2 do system prompt por hooks/session-start/forge-context.sh
# Cada § exige confidence + data + run_id (C6 — rastreabilidade)
# NUNCA: credenciais, tokens, CPF/CNPJ real, email de usuário (C8/security)
project_name: Aicfo
last_updated: 2026-05-20
active_facts: 28
---

# Agent Memory — Aicfo

> Fatos aprendidos do projeto Aicfo ao longo das sessões Forge. Curado pelo `learning-curator` guardian a partir de snapshots em `docs/learnings/`.

## § integration_quirks

§ [confidence:shadow] [2026-05-11] [run:local] `pdf-parse` é CJS sem default export — usar `createRequire` em Node 24 (`src/ingest/parsers/pdf.ts`)
§ [confidence:shadow] [2026-05-11] [run:local] Anthropic com `jsonMode:true` envolve resposta em ```json fences``` — usar `stripJsonFences()` em `src/llm/adapters/anthropic.ts`
§ [confidence:shadow] [2026-05-12] [run:local] xlsx@0.18.5 tem CVE sem fix upstream — mitigado via MAX_XLSX_BYTES=20MB + MAX_XLSX_ROWS=50000 + acesso defensivo a SheetNames/Sheets (ADR-003)
§ [confidence:shadow] [2026-05-12] [run:local] Stripe SDK v22+ moveu `current_period_start/end` pra `items.data[]` — usar helper `getSubscriptionPeriod()` em `src/billing/`
§ [confidence:shadow] [2026-05-11] [run:local] `tsx watch` NÃO recarrega `.env` automaticamente — reiniciar servidor manualmente após mudar variável

## § process_patterns

§ [confidence:local] [2026-05-19] [run:local] Rafael prefere passo-a-passo investigativo em bugs antes de propor fix
§ [confidence:local] [2026-05-19] [run:local] Rafael prefere bullets/tabelas a parágrafos longos; respostas curtas
§ [confidence:local] [2026-05-19] [run:local] Conventional commits com module key obrigatório no title para sync ClickUp funcionar
§ [confidence:local] [2026-05-20] [run:local] Branch → PR → merge é regra dura; PRs com `--delete-branch` só em PRs sem cascata
§ [confidence:local] [2026-05-20] [run:local] Rafael aceita squash --admin --delete-branch quando autoriza explicitamente — não assumir

## § pitfalls

§ [confidence:shadow] [2026-05-20] [run:local] `gh pr merge --delete-branch` na base de PRs filhos → GitHub auto-fecha filhos e bloqueia `gh pr edit --base`. Solução: rebase manual + `gh pr create` novos. Custo: 3 PRs (#4/#5/#6 → #7/#8/#9)
§ [confidence:shadow] [2026-05-14] [run:local] `gemini-2.5-flash-lite` acerta só 68% em ledger_classified — 32% erro silencioso. Trocado por gpt-4.1-mini (100% accuracy)
§ [confidence:shadow] [2026-05-14] [run:local] `gemini-2.0-flash` descontinuado pra novos usuários (cartão configurado após janela) — usar gemini-2.5-flash-lite ou flash
§ [confidence:shadow] [2026-05-19] [run:local] Qwen3-32B AS-IS pensa em EN, ignora restrições e estoura TPM no free tier — não viável sem FT (PR #2 conclusivo)
§ [confidence:shadow] [2026-05-20] [run:gh-3.C.1] Subagent general-purpose em escopo grande (10+ files) tem risco real de `API Error: Overloaded` no meio (28 tool_uses sem nada commitado) — preferir 1 file por subagent ou fazer manualmente

## § confirmed_patterns

§ [confidence:shadow] [2026-05-20] [run:local] 3 subagents general-purpose em paralelo escrevendo files isolados + parent serializando git/PR = ~5min vs ~15-30min sequencial (validado em PR #11)
§ [confidence:shadow] [2026-05-20] [run:local] Rule-based sem LLM (`financial-diagnosis.ts`) = zero custo + zero alucinação + 100% testável (validado em PR #8)
§ [confidence:shadow] [2026-05-14] [run:local] gpt-4.1-mini para classification: 100% accuracy DRE + 1.1s/case + custo absorvível (C3 0.22%)
§ [confidence:shadow] [2026-05-20] [run:local] LangGraph 1.2 paralelismo via barrier implícito (N edges convergindo em 1 nó) funciona — validado em fan-out anomaly/margin/cashflow (PR #13)
§ [confidence:shadow] [2026-05-19] [run:local] llm_as_judge runner com gpt-4.1-mini valida dre-narrative com pass rate ≥50% no baseline Gemini (PR #1)

## § tech_constraints

§ [confidence:shadow] [2026-05-11] [run:local] Node 20 ESM + `noUncheckedIndexedAccess` ativo — guards `?? ""` necessários em parsers de string indexada
§ [confidence:shadow] [2026-05-20] [run:local] Prisma `LedgerDirection` enum = "credit"|"debit"; agentic agents usam "in"|"out" — mapear na conversão (load-analysis node)
§ [confidence:shadow] [2026-05-12] [run:local] tsconfig `strict` + `noImplicitReturns` + zero `any` em `src/skus/` ou `src/agents/` (hook `any-type-guard` enforça)
§ [confidence:shadow] [2026-05-14] [run:local] frontend em `app/` (mesmo repo, ADR-006) — Vite na porta 5173 + `VITE_API_URL=http://localhost:3000`
§ [confidence:shadow] [2026-05-20] [run:local] @langchain/langgraph 1.2: `Annotation.Root({ ... })` + array channels com `reducer: (curr, next) => [...curr, ...next]` para fan-out

## § economics_real

§ [confidence:shadow] [2026-05-14] [run:local] Pipeline BullMQ legacy (gpt-4.1-mini classification): R$ 0,222/análise p50 — C3 0,22% no Lite (folga 113×)
§ [confidence:shadow] [2026-05-20] [run:local] Pipeline agentic LangGraph projetado: R$ 0,44/análise (dobra do legacy) — C3 0,44% no Lite (folga 56×) — **AINDA NÃO VALIDADO em SHADOW real**
§ [confidence:local] [2026-05-19] [run:local] R$ 3,30 total em chamadas LLM durante todo o dia 2026-05-19 (benchmarks Gemini × Sonnet × Qwen) — trivial vs valor de decisão informada

## § telemetry_hints

§ [confidence:shadow] [2026-05-12] [run:local] `callLlm` em `src/llm/index.ts` já envelopa `createTrace` do Langfuse — agentes NÃO precisam de `observe()` extra
§ [confidence:shadow] [2026-05-12] [run:local] LlmResponse.traceId deve propagar até `state.costs[].traceId` (gap atual: agentes não expõem LlmResponse — Wave 3.C.2 do roadmap LangGraph corrige)
§ [confidence:local] [2026-05-20] [run:local] Decisão pendente: migrar Langfuse → LangSmith para integração nativa com LangGraph; trade-off LGPD (Langfuse self-host BR vs LangSmith US-hosted)

## § pii_categories

§ [confidence:local] [2026-05-20] [run:local] PII presente em produção: email do CEO/cliente, CNPJ da empresa, descrições de lançamentos podem conter nome de contraparte (pessoa física)
§ [confidence:local] [2026-05-20] [run:local] Dados bancários: ainda não em produção; entram com `integrations-banks` (Onda 4)
