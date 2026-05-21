---
adr_id: "008"
title: "Coexistência LangGraph MVP e BullMQ legacy no monthly-analysis"
status: "proposta"
constitution_version: "0.3.0"
created_at: "2026-05-20"
last_updated: "2026-05-20"
authors: ["Rafael Novaes", "Hermes Agent"]
supersedes: []
superseded_by: []
linked_principles: [C2, C3, C4, C6, C7]
linked_docs:
  - "docs/monthly-analysis/agent-model-plan.md"
  - "docs/monthly-analysis/tasks-langgraph-mvp.md"
  - "docs/monthly-analysis/shadow-cost-baseline.md"
---

# ADR-008 — Coexistência LangGraph MVP e BullMQ legacy no monthly-analysis

## Status

Proposta.

## Contexto

O SKU `monthly-analysis` já possui pipeline legacy em produção baseado em BullMQ workers. Esse caminho processa a análise mensal e permanece como caminho cobrável/entregável.

Em paralelo, o Aicfo está introduzindo um pipeline agentic em LangGraph para decompor a análise mensal em agentes/nós menores: normalização, avaliação de clareza, classificação DRE, diagnósticos financeiros, síntese narrativa, plano de ação e QA financeiro.

A Constitution exige:

- **C2 — Outcome-first**: a mudança deve preservar o outcome cobrável, não trocar stack por stack.
- **C3 — Economic viability**: custo por análise deve ser medido antes da promoção.
- **C4 — Shadow-before-billing**: agente novo não pode entregar/cobrar sem SHADOW mínimo e critérios de promoção.
- **C6 — Telemetry by default**: chamadas LLM, custo, latência e resultado precisam ser auditáveis.
- **C7 — Portability**: dependências de provider/modelo ficam atrás do router/camadas existentes, não hardcoded nos agentes.

## Decisão

Adotar coexistência controlada entre BullMQ legacy e LangGraph MVP:

1. **BullMQ legacy permanece produção** para `monthly-analysis` até nova ADR ou atualização explícita desta ADR.
2. **LangGraph roda apenas em SHADOW** por CLI/teste, usando `scripts/run-monthly-analysis-graph-shadow.ts`.
3. O runner SHADOW compara uma análise já processada pelo legacy contra a saída agentic e gera artefatos em `evals/monthly-analysis/shadow-runs/`.
4. O runner SHADOW **não escreve** em modelos Prisma de produção; leituras no banco são permitidas para carregar inputs e resultados legacy.
5. Promoção para ASSISTED só pode ocorrer após baseline real em `docs/monthly-analysis/shadow-cost-baseline.md`, gates de qualidade/custo cumpridos e aprovação humana explícita.
6. Substituição do BullMQ legacy por LangGraph como default fica fora do escopo desta decisão.

## Arquitetura operacional durante coexistência

### Caminho de produção

- Entrada de análise mensal chega ao backend.
- BullMQ enfileira e executa workers legacy.
- Legacy persiste classificações, cards narrativos e plano de ação nos modelos de produção existentes.
- Cliente recebe apenas o resultado legacy aprovado pelo fluxo atual.

### Caminho SHADOW

- Operador escolhe um `analysisId` real já processado pelo legacy.
- Executa:

```bash
npm run shadow:graph -- --analysisId=<uuid>
```

- O runner:
  - descobre `tenantId` se necessário;
  - invoca o grafo LangGraph;
  - lê resultados legacy já persistidos;
  - calcula diff de classificação, narrativa e plano;
  - grava JSON + relatório markdown em `evals/monthly-analysis/shadow-runs/`.

### Proibição explícita

Durante SHADOW, LangGraph não pode:

- entregar output ao cliente;
- alterar status de `MonthlyAnalysis` em produção;
- sobrescrever cards/plano/classificações legacy;
- acionar cobrança;
- virar worker default sem nova decisão.

## Métricas a coletar

O runner e o baseline devem coletar, por run:

- `analysisId` e `tenantId`;
- custo total e custo por agente/nó;
- latência total e por nó;
- modelos/fallbacks usados;
- `classification.matchPct`;
- total de divergências de classificação;
- narrative type overlap;
- contagem de cards legacy × agentic;
- contagem de ações por horizonte;
- `plan.coverageMatch`;
- erros em `state.errors[]`;
- link/ID de traces Langfuse quando disponível;
- avaliação humana: aprovado, investigar ou bloqueado.

## Critérios de promoção para ASSISTED

A promoção de LangGraph para ASSISTED exige todos os itens abaixo:

- Pelo menos **10 runs SHADOW válidos**.
- Preferencialmente **3 tenants distintos** na amostra.
- Janela SHADOW mínima de **14 dias**, conforme C4.
- Baseline real preenchido em `docs/monthly-analysis/shadow-cost-baseline.md`.
- Custo por outcome compatível com C3, usando o limite econômico aplicável ao SKU.
- `classification.matchPct` médio ≥ **90%**.
- Nenhuma divergência crítica não explicada em categorias financeiras essenciais.
- Narrative type overlap esperado em **100%** dos runs.
- `plan.coverageMatch=true` em ≥ **95%** dos runs.
- QA gate ativo ou revisão humana substituta registrada até o QA gate estar completo.
- `npm test` e typecheck/build relevantes verdes no commit candidato.
- Aprovação humana explícita do mantenedor/CEO.

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

- Cumpre C4: nenhuma troca de produção sem SHADOW.
- Preserva o outcome cobrável enquanto mede qualidade/custo do LangGraph.
- Permite comparação real contra o legado sem impactar cliente.
- Cria trilha auditável para decisão de promoção.
- Reduz risco de reescrita big-bang do pipeline.

### Negativas

- Mantém dois caminhos conceituais durante a janela de avaliação.
- A comparação inicial pode medir aderência ao legacy, não necessariamente verdade financeira absoluta.
- Custo SHADOW consome orçamento antes de entregar valor direto ao cliente.
- Requer disciplina manual para selecionar amostras e registrar baseline.

### Mitigações

- Amostra mínima e gates explícitos antes de ASSISTED.
- Baseline documentado com placeholders até dados reais existirem.
- Revisão humana obrigatória durante SHADOW.
- Langfuse/telemetry como gate, não como melhoria opcional.
- BullMQ permanece fallback operacional e produção.

## Alternativas consideradas

### Substituir BullMQ imediatamente por LangGraph

Rejeitada. Violaria C4 e aumentaria risco comercial: não há baseline real de custo/qualidade suficiente.

### Manter LangGraph apenas como experimento sem dados reais

Rejeitada. Sem runs reais contra análises legacy, a decisão de promoção não seria auditável nem econômica.

### Rodar LangGraph dentro dos workers BullMQ desde já

Rejeitada para esta fase. Misturar SHADOW com worker de produção aumenta risco de side effect e dificulta separar comportamento cobrável de comportamento experimental.

### Remover BullMQ e usar LangGraph como fila/orquestrador único

Rejeitada. LangGraph resolve orquestração de estado/agentes; BullMQ segue útil para processamento assíncrono, retries e isolamento operacional. A decisão futura pode ser composição, não substituição total.

## Plano de revisão

Revisar esta ADR quando houver:

- baseline real com amostra mínima preenchida;
- QA gate conectado ao grafo;
- telemetry completa de custo/latência por agente;
- decisão humana sobre promoção para ASSISTED.

## Aprovação

- [ ] Mantenedor (Rafael)
- [ ] CEO

**Aprovado por**: pendente
