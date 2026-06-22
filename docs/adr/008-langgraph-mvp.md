---
adr_id: "008"
title: "Pipeline monthly-analysis com LangGraph e BullMQ como fila de jobs"
status: "aceita"
constitution_version: "0.3.0"
created_at: "2026-05-20"
last_updated: "2026-06-22"
authors: ["Rafael Novaes", "Hermes Agent"]
supersedes: []
superseded_by: []
linked_principles: [C2, C3, C4, C6, C7]
linked_docs:
  - "src/monthly-analysis/graph/index.ts"
  - "src/queue/workers.ts"
---

# ADR-008 — Coexistência LangGraph MVP e BullMQ legacy no monthly-analysis

## Status

Aceita.

## Contexto

O SKU `monthly-analysis` evoluiu de um pipeline legacy baseado em BullMQ workers para um grafo LangGraph com 13 nós (normalização, classificação DRE, agregação DRE, detecção de anomalias, diagnóstico de margem, risco de caixa, síntese narrativa, geração de plano de ação, QA financeiro, finalização).

BullMQ permanece como **fila de jobs assíncrona** e mecanismo de retry, mas o processamento da análise em si é orquestrado pelo grafo LangGraph.

A Constitution exige:

- **C2 — Outcome-first**: a mudança preserva o outcome cobrável (análise mensal entregue).
- **C3 — Economic viability**: custo por análise é medido via LangSmith e auditado mensalmente.
- **C4 — Shadow-before-billing**: o SKU opera nos modos SHADOW/PILOT/ASSISTED/AUTONOMOS conforme configuração de subscription; promoção exige evals e aprovação humana.
- **C6 — Telemetry by default**: chamadas LLM, custo, latência e resultado são auditáveis via LangSmith.
- **C7 — Portability**: dependências de provider/modelo ficam em `src/llm/`; o grafo consome via router.

## Decisão

Adotar LangGraph como orquestrador do pipeline `monthly-analysis`, com BullMQ como fila de jobs:

1. **BullMQ enfileira o job** `monthly-analysis` via `enqueueMonthlyAnalysisGraph()`.
2. **Worker consome o job e executa o grafo LangGraph** em `src/monthly-analysis/graph/index.ts`.
3. O grafo persiste resultados (DRE, cards, plano de ação, status) nos modelos Prisma de produção.
4. Modos de execução (SHADOW/PILOT/ASSISTED/AUTONOMOUS) são controlados pelo campo `mode` da subscription e da análise.
5. Promoção entre modos segue os critérios de `docs/onda-0/lifecycle_monthly_analysis.md` e ADR-013 (Synthetic pre-validation pode substituir parte da janela SHADOW).
6. Substituição do BullMQ por outro mecanismo de fila fica fora do escopo; LangGraph não gerencia fila, apenas orquestração de estado.

## Arquitetura operacional

### Caminho de produção

- Entrada de análise mensal chega ao backend (`POST /ingest/*`).
- BullMQ enfileira o job `monthly-analysis`.
- Worker consome o job e executa o grafo LangGraph.
- Grafo persiste classificações, cards narrativos e plano de ação nos modelos de produção.
- Cliente recebe o resultado conforme o modo da subscription:
  - **SHADOW**: análise gerada mas não entregue ao cliente; revisão humana em paralelo.
  - **PILOT**: entregue para ≤50 clientes controlados; sem cobrança variável adicional.
  - **ASSISTED**: entregue; cliente pode editar/comentar antes de aprovar.
  - **AUTONOMOUS**: entregue diretamente; cliente audita amostra.

### Caminho SHADOW manual

- Operador pode executar o grafo em modo shadow via:

```bash
npm run shadow:graph -- --analysisId=<uuid>
```

- O runner gera relatório comparativo sem afetar o estado de produção.

### Proibição explícita

No modo SHADOW, o grafo não pode:

- entregar output ao cliente;
- alterar status de `MonthlyAnalysis` para `delivered`/`approved` sem aprovação humana;
- acionar cobrança.

## Métricas a coletar

LangSmith e audit logs coletam, por run:

- `analysisId` e `tenantId`;
- custo total e custo por agente/nó;
- latência total e por nó;
- modelos/fallbacks usados;
- `classification.matchPct` (regra vs. LLM);
- total de divergências de classificação;
- narrative type overlap;
- contagem de cards por tipo;
- contagem de ações por horizonte;
- `plan.coverageMatch`;
- erros em `state.errors[]`;
- link/ID de traces LangSmith;
- avaliação humana: aprovado, investigar ou bloqueado.

## Critérios de promoção de modo

A promoção do SKU `monthly-analysis` entre os modos SHADOW → PILOT → ASSISTED → AUTONOMOUS exige todos os itens abaixo (adaptados por modo):

- Eval suite passing por módulo (`ingest`, `classification`, `dre-narrative`, `action-plan`).
- Pelo menos **N execuções no modo atual** (definido em `docs/onda-0/lifecycle_monthly_analysis.md`).
- Custo por outcome compatível com C3.
- `classification.matchPct` médio ≥ **90%**.
- Nenhuma divergência crítica não explicada em categorias financeiras essenciais.
- Narrative type overlap esperado em **100%** dos runs.
- `plan.coverageMatch=true` em ≥ **95%** dos runs.
- QA gate ativo ou revisão humana substituta registrada.
- `npm test`, typecheck e build verdes.
- Aprovação humana explícita do mantenedor/CEO.

A Rota B da ADR-013 (Synthetic pre-validation) pode substituir a janela SHADOW de 14 dias para entrada em PILOT.

## Critérios de rollback/bloqueio

Enquanto LangGraph está em SHADOW, rollback significa **não promover** e manter BullMQ como produção.

Bloquear promoção se ocorrer:

- custo médio/p95 incompatível com C3;
- telemetry incompleta para auditar custo/latência;
- erro de side effect ou escrita acidental em produção;
- divergências sistemáticas de classificação;
- narrativa contradizendo DRE ou sem evidência;
- plano sem cobertura mínima dos horizontes;
- falhas recorrentes de provider/modelo sem fallback confiável;
- revisão humana reprova a qualidade ou risco comercial.

Se LangGraph já tiver sido promovido futuramente para ASSISTED, rollback deve manter feature flag/configuração que direcione novas análises ao BullMQ legacy até nova aprovação. Esta ADR não implementa essa flag; apenas estabelece a necessidade para uma promoção futura.

## Consequências

### Positivas

- Cumpre C4: promoção por modos controlados.
- Preserva o outcome cobrável com orquestração explícita de estado.
- Cria trilha auditável para decisão de promoção.
- Reduz risco de reescrita big-bang do pipeline.
- BullMQ aproveitado para confiabilidade de fila e retry.

### Negativas

- Maior complexidade operacional vs. pipeline monolítico.
- Custo de inferência precisa ser monitorado de perto (C3).
- Requer disciplina para manter eval suites atualizadas.

### Mitigações

- Eval suites por módulo e gates explícitos antes de promoção.
- Revisão humana obrigatória nos modos SHADOW/PILOT.
- LangSmith/telemetry como gate, não como melhoria opcional.
- Fallback de provider via `src/llm/router.ts`.

## Alternativas consideradas

### Substituir BullMQ imediatamente por LangGraph como fila

Rejeitada. LangGraph não é fila; manter BullMQ preserva retry, delays e observabilidade de jobs.

### Manter pipeline legacy BullMQ sem LangGraph

Rejeitada. Pipeline monolítico dificulta evolução, testes e auditoria por nó (C6).

### Rodar LangGraph síncrono na request HTTP

Rejeitada. Análise pode levar minutos; processamento assíncrono via fila é obrigatório para UX e confiabilidade.

## Plano de revisão

Revisar esta ADR quando houver:

- baseline real com amostra mínima preenchida;
- QA gate conectado ao grafo;
- telemetry completa de custo/latência por agente;
- decisão humana sobre promoção para ASSISTED.

## Aprovação

- [x] Mantenedor (Rafael)
- [x] CEO

**Aprovado por**: Rafael Novaes <rafaeldenovaes@gmail.com> — 2026-06-22
