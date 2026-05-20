---
title: Monthly Analysis — baseline SHADOW de custo e qualidade
status: draft_shadow_baseline
created_at: 2026-05-20
last_updated: 2026-05-20
owners: ["Rafael Novaes"]
linked_adr: ../adr/008-langgraph-mvp.md
linked_runner: ../../scripts/run-monthly-analysis-graph-shadow.ts
constitution_principles: [C3, C4, C6]
---

# Monthly Analysis — baseline SHADOW de custo e qualidade

## 1. Escopo

Este documento registra o baseline inicial para decidir se o pipeline agentic em LangGraph do SKU `monthly-analysis` pode sair de **SHADOW** e avançar para **ASSISTED**.

Estado em 2026-05-20:

- **Produção/caminho cobrável**: BullMQ legacy continua sendo a fonte de verdade para processamento e entrega.
- **LangGraph**: roda apenas em SHADOW via `npm run shadow:graph -- --analysisId=<uuid>`.
- **Sem side effects de produção**: o runner lê dados existentes e escreve apenas artefatos em `evals/monthly-analysis/shadow-runs/`.
- **Sem entrega ao cliente**: outputs agentic são comparação interna, não material publicado.

Este baseline cumpre:

- **C3 — Economic viability**: medir custo por outcome antes de cobrar/promover.
- **C4 — Shadow-before-billing**: exigir janela e critérios declarados antes de produção.
- **C6 — Telemetry by default**: associar custo/latência/qualidade a runs auditáveis.

## 2. Baseline inicial — placeholders explícitos

> **Importante:** os valores abaixo são placeholders operacionais até existirem runs reais. Não representam medição de produção, não devem ser usados como evidência de promoção e devem ser substituídos por dados de `evals/monthly-analysis/shadow-runs/` + Langfuse assim que houver amostra suficiente.

### Premissas provisórias

- Estimativa de custo por run mencionada no README de SHADOW: **R$ 0,44 por análise**.
- Natureza da estimativa: **projeção inicial**, não medição auditada.
- Status de custo real: **pendente**.
- Fonte esperada para custo real: `state.costs[]`, traces Langfuse e/ou metadados de chamadas LLM emitidos pelos nós do grafo.

### Tabela de baseline a preencher

- Período da amostra: `TODO: YYYY-MM-DD..YYYY-MM-DD`
- Número de runs SHADOW válidos: `TODO: N`
- Número de tenants distintos: `TODO: N`
- Custo médio por análise: `TODO: R$ X,XX`
- Custo p50 por análise: `TODO: R$ X,XX`
- Custo p95 por análise: `TODO: R$ X,XX`
- Latência p50 end-to-end: `TODO: Xs`
- Latência p95 end-to-end: `TODO: Xs`
- Taxa média de match de classificação: `TODO: X%`
- Narrative type overlap: `TODO: X% dos runs com 100% overlap`
- Plan coverage match: `TODO: X% dos runs true`
- Runs com `needsReview=true`: `TODO: X%` (quando QA gate estiver ativo)
- Taxa de erro do runner: `TODO: X%`
- Observações do humano revisor: `TODO`

## 3. Métricas obrigatórias por run

O runner `scripts/run-monthly-analysis-graph-shadow.ts` deve produzir, direta ou indiretamente, as evidências abaixo por `analysisId`.

### Identificação e rastreabilidade

- `analysisId`
- `tenantId`
- data/hora ISO da execução
- versão/commit do código usado na execução (preencher manualmente no relatório agregado se o runner não gravar ainda)
- caminho do JSON gerado
- caminho do relatório markdown gerado
- link/trace ID Langfuse quando disponível

### Custo e desempenho

- custo total por análise em centavos e em R$
- custo por agente/nó LLM
- modelo primário usado por agente
- fallback acionado por agente, se houver
- contagem de retries
- latência end-to-end
- latência por nó
- tokens de input/output por chamada LLM quando disponível

### Qualidade comparativa LangGraph × BullMQ legacy

- `classification.matchPct`
- número total de lançamentos avaliados
- número de divergências de classificação
- top divergências por `entryId`
- quantidade de cards legacy × agentic
- overlap de tipos de narrativa
- quantidade de ações por horizonte (`short`, `medium`, `long`)
- `plan.coverageMatch`

### Segurança operacional

- confirmação de que o runner não escreveu em modelos Prisma de produção
- erros capturados em `state.errors[]`
- `needsReview` quando o QA gate estiver conectado
- bloqueadores observados pelo revisor humano

## 4. Como gerar runs reais

Pré-requisitos:

- `.env` com `DATABASE_URL` apontando para ambiente autorizado de SHADOW/staging.
- Chaves LLM necessárias para os providers configurados.
- `analysisId` de uma `MonthlyAnalysis` já processada pelo BullMQ legacy.
- Permissão explícita para usar a análise como amostra interna.

Comando:

```bash
npm run shadow:graph -- --analysisId=<uuid>
```

Opcionalmente, fixar tenant:

```bash
npm run shadow:graph -- --analysisId=<uuid> --tenantId=<uuid>
```

Outputs esperados:

- `evals/monthly-analysis/shadow-runs/{YYYY-MM-DD}-{analysisId}.json`
- `evals/monthly-analysis/shadow-runs/{YYYY-MM-DD}-{analysisId}-report.md`

## 5. Como preencher este baseline com dados reais

Após cada lote de runs:

1. Validar que cada JSON contém `state`, `legacy`, `agentic` e `diff`.
2. Excluir runs abortados antes da conclusão do grafo; registrar separadamente como erro operacional.
3. Agregar custo usando `state.costs[]` e traces Langfuse.
4. Agregar qualidade usando `diff.classification`, `diff.narrative` e `diff.plan`.
5. Registrar amostra mínima: análise, tenant, data, custo, match de classificação, overlap narrativo, coverage de plano e decisão humana.
6. Substituir os `TODO` deste documento por números reais e citar o diretório/commit dos artefatos usados.
7. Não apagar a estimativa inicial; mover para seção de histórico quando os números reais existirem.

Modelo de linha para agregação manual:

- Run: `{YYYY-MM-DD}-{analysisId}`
  - Tenant: `TODO`
  - Commit: `TODO`
  - Custo total: `TODO`
  - Latência total: `TODO`
  - Classification match: `TODO`
  - Narrative overlap: `TODO`
  - Plan coverage match: `TODO`
  - Erros: `TODO`
  - Decisão humana: `aprovar para amostra` / `investigar` / `bloquear`

## 6. Gates de promoção SHADOW → ASSISTED

LangGraph só pode virar caminho ASSISTED se todos os gates abaixo passarem em uma amostra representativa.

### Amostra mínima

- Pelo menos **10 analyses reais**.
- Pelo menos **3 tenants distintos**, quando disponível.
- Janela mínima de **14 dias em SHADOW** conforme C4, ou justificativa formal se a amostra ainda não cobrir 14 dias.
- Nenhum output agentic entregue diretamente ao cliente durante a coleta.

### Gates econômicos

- Custo médio real por análise documentado.
- Custo p95 documentado.
- Custo por outcome compatível com C3: dentro do limite econômico aplicável ao SKU (default Forge: custo ≤ 25% do preço/ARPU alocado).
- Ausência de fallback caro em cascata sem justificativa.

### Gates de qualidade

- `classification.matchPct` médio ≥ **90%**.
- Nenhum run com divergência crítica não explicada em categorias financeiras essenciais.
- Narrative type overlap esperado em **100%** dos runs: `critical_gap`, `attention`, `healthy`.
- `plan.coverageMatch=true` em ≥ **95%** dos runs.
- QA gate sem blocker antes de entrega, quando implementado.
- Aprovação humana explícita do mantenedor/CEO para mudança de modo.

### Gates operacionais

- `npm test` e typecheck/build relevantes verdes no commit candidato.
- Traces/custos auditáveis para chamadas LLM.
- Plano de rollback documentado e executável.
- Nenhuma escrita acidental em tabelas de produção pelo runner SHADOW.

## 7. Critérios de rollback ou bloqueio

Manter BullMQ como produção e bloquear promoção se qualquer item abaixo ocorrer:

- custo médio ou p95 inviabiliza C3;
- `classification.matchPct` abaixo do gate ou divergências concentradas em categorias críticas;
- narrativa sem evidência numérica ou contradizendo DRE/diagnósticos;
- plano sem cobertura mínima de horizontes;
- falha de telemetry/custo que impeça auditoria;
- erro de side effect em produção;
- revisor humano identifica risco comercial ou financeiro não mitigado.

Rollback operacional na fase SHADOW é simples: **não promover**. Como BullMQ segue em produção, basta parar de rodar o runner e abrir issue/PR de correção do grafo/prompts.

## 8. Riscos conhecidos

- `state.costs[]` pode ainda estar incompleto dependendo da instrumentação dos nós.
- O diff de narrativa/plano é majoritariamente estrutural; qualidade semântica depende de revisão humana e futura avaliação `llm_as_judge`.
- Uma análise já processada pelo legacy pode conter erro legacy; match alto não garante verdade financeira absoluta.
- Runs com poucos lançamentos podem inflar métricas; amostra deve incluir casos simples e complexos.
- Providers/modelos podem variar custo/latência; registrar commit e configuração do `.env` sem vazar segredos.

## 9. Status atual

- Baseline criado: **2026-05-20**.
- Dados reais agregados: **pendente**.
- Decisão de promoção: **pendente**.
- Produção: **BullMQ legacy permanece ativo**.
- LangGraph: **SHADOW interno apenas**.
