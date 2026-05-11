# Backend — action-plan

**Status:** complete
**Commit:** 4d5892a
**Implementado em:** 2026-05-11

## Entregáveis

- `src/action-plan/generator.ts` — gera plano via LLM, valida mínimos (3 short + 1 medium + 1 long), retry automático, C4 (autonomous → delivered)
- `src/action-plan/prompts.ts` — system prompt L0 + user prompt L1+L2 (DRE + cards narrativos)
- `src/action-plan/routes.ts` — GET /analysis/:id/action-plan (com summary por horizonte), PATCH feedback, POST /analysis/:id/approve
- Worker BullMQ: concorrência 2, integrado em src/queue/workers.ts

## Comportamento

- Modelo primário: Gemini 2.5 Flash com thinkingBudget: 2048 (C7)
- Validação mínima: ≥3 ações short + ≥1 medium + ≥1 long; retry único se não atendido
- C4: mode=autonomous → status=delivered + deliveredAt; demais → status=ready
- Campos: horizon, title, description, effortLevel, riskLevel, impactCents, deadlineDays, doneWhen
- Testado em produção: 62 lançamentos → 6 ações, impacto total R$18.082/mês, accuracy 1.00
