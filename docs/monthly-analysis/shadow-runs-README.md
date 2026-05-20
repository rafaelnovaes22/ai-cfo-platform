# SHADOW runs — monthly-analysis LangGraph × BullMQ legacy

## O que é

Diretório `evals/monthly-analysis/shadow-runs/` recebe os outputs do runner SHADOW que invoca o **pipeline agentic LangGraph** contra um `analysisId` real já processado pelo **pipeline BullMQ legacy** e gera diff comparativo.

Sem isso, não conseguimos decidir se o pipeline agentic está pronto para substituir o legacy.

## Como rodar

```bash
# Pré-requisitos:
# - .env com OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY (ANTHROPIC_API_KEY opcional para fallback)
# - DATABASE_URL apontando para o mesmo banco do legacy
# - Uma MonthlyAnalysis com status >= "ready" (ou seja, já passou pelo pipeline legacy)

npm run shadow:graph -- --analysisId=<uuid>

# Opcional: forçar tenantId (default lê do banco)
npm run shadow:graph -- --analysisId=<uuid> --tenantId=<uuid>
```

## Outputs

Para cada run, dois arquivos em `evals/monthly-analysis/shadow-runs/`:

- `{YYYY-MM-DD}-{analysisId}.json` — snapshot completo: state agentic + resultados legacy + diff calculado
- `{YYYY-MM-DD}-{analysisId}-report.md` — relatório markdown com 3 seções (classification / narrative / plan)

## Garantias

- **Não escreve** em nenhum modelo Prisma de produção (só read)
- **Chama LLMs reais** — custo absorvido pelo `.env` do operador (estimativa: R$ 0,44 por run no plano Lite)
- Falha cedo se o `analysisId` não existir ou se a análise não tiver `LedgerEntry` associadas

## Como interpretar o report

### Classification match rate
- **≥ 95%**: agentic está alinhado ao legacy — promover
- **85–95%**: investigar divergências antes de promover
- **< 85%**: regressão; rollback ou refinar prompts antes de novo SHADOW

### Narrative type overlap
- Esperado: 3 tipos overlapping (`critical_gap`, `attention`, `healthy`) — composição enforçada pelo schema do agentic
- Se legacy tiver tipos extras: legacy não está padronizado, OK
- Se agentic tiver tipo só dele: bug

### Plan coverage match
- Esperado: ambos com ≥3 short, ≥1 medium, ≥1 long
- Schema do agentic já enforça — se `false`, problema é no legacy

## Decisão de promoção

Após N runs SHADOW (sugestão: 10 analyses de tenants diferentes), agregar:
- Mean classification match rate ≥ 90%
- Narrative type overlap = 100% em todos os runs
- Plan coverage match = true em ≥ 95% dos runs

→ aprovar promoção via `/acme:promote` (Gate 4: eval suite).

## Limitações conhecidas

- **Sem custo tracking**: `state.costs` está vazio (Wave 3.C.2 vai enriquecer agentes)
- **Sem QA gate**: nó `qa_review` ainda não está wired no grafo (Wave 5.A.2)
- **Narrative/plan diff é estrutural** — não compara qualidade semântica (Wave futura: usar `llm_as_judge` aqui também)
