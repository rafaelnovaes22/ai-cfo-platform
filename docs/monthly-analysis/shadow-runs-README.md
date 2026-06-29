# SHADOW runs — monthly-analysis (APOSENTADO)

> **Status: aposentado em 2026-06-29.** O runner `scripts/run-monthly-analysis-graph-shadow.ts` e o npm script `shadow:graph` foram removidos.

## Por que foi aposentado

O runner existiu para comparar **dois pipelines em paralelo**: o agentic LangGraph contra o BullMQ legacy (3 jobs: classification → dre-narrative → action-plan), gerando um diff por `analysisId` para decidir se o agentic estava pronto para substituir o legacy.

Com o flip do orquestrador único (#180/#182), o pipeline legacy foi **removido**. O grafo agentic passou a ser o pipeline de produção, e seu nó `finalize` persiste classificações, cards e plano. A partir daí o runner deixou de fazer sentido e tornou-se nocivo:

- Não há mais "legacy" para comparar — `loadLegacyResults` lia das mesmas tabelas (`LedgerEntry`/`NarrativeCard`/`ActionPlanItem`) que o próprio grafo agora popula.
- `graph.invoke()` executa o `finalize`, que **sobrescreve os dados de produção** da análise — contrariando a garantia "não escreve" do antigo cabeçalho.
- A comparação resultante era o grafo contra ele mesmo (match ~100%), sem valor analítico.

## O que usar no lugar

- Validação de qualidade do pipeline: eval suites em `evals/monthly-analysis/` (`npm run eval:llm`).
- Promoção entre modos (SHADOW/PILOT/ASSISTED/AUTONOMOUS): `/acme:promote` (gates C4).
- Inspeção de runs reais: traces LangSmith (C6).
