# Backend — dre-narrative

**Status:** complete
**Commit:** cab4d85
**Implementado em:** 2026-05-11

## Entregáveis

- `src/dre-narrative/aggregator.ts` — agregação DRE determinística (sem LLM), interface DreLines, formatDreForPrompt()
- `src/dre-narrative/narrator.ts` — orquestra: agrega DRE → LLM → persiste 3 NarrativeCards → encadeia action-plan
- `src/dre-narrative/prompts.ts` — system prompt L0 (cacheável) + user prompt L1+L2
- `src/dre-narrative/routes.ts` — GET /analysis/:id/narrative, PATCH feedback por card, POST /analysis/:id/deliver
- Worker BullMQ: concorrência 2, integrado em src/queue/workers.ts

## Comportamento

- Modelo primário: Gemini 2.5 Flash com thinking budget (C7)
- Gera exatamente 3 cards: critical_gap, attention, healthy
- dreJson e narrativeJson salvos em MonthlyAnalysis (snapshot para export)
- Modo ASSISTED: cliente pode aprovar/comentar cada card individualmente
