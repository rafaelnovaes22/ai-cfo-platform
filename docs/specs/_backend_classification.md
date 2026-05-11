# Backend — classification

**Status:** complete
**Commit:** 02ea90b
**Implementado em:** 2026-05-11

## Entregáveis

- `src/classification/classifier.ts` — classifica em batches de 20, confiança <0.7 → needs_review, encadeia dre-narrative
- `src/classification/prompts.ts` — system prompt L0 (cacheável) + user prompt L1+L2
- `src/classification/taxonomy.ts` — 23 categorias DRE, fonte única da verdade
- `src/classification/routes.ts` — PATCH /ledger/:id/correction (correção manual + flywheel)
- Worker BullMQ: concorrência 3, integrado em src/queue/workers.ts

## Comportamento

- Modelo primário: Gemini 2.0 Flash (C7 — roteado em src/llm/router.ts)
- Fallback automático: Anthropic Claude Sonnet
- Flywheel: correctedCategory + correctionSource gravados no LedgerEntry para dataset de treino
- Auto-approve: confiança ≥ 0.7 + sem correção → confirmedCategory = predictedCategory
