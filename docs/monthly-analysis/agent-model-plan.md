# Monthly Analysis — plano de agentes e seleção de modelos

Status: fundação em construção  
Branch: `feat/aicfo-monthly-analysis-agent-routing`

## Objetivo

Substituir a decisão genérica de “um modelo para fazer a análise financeira” por um pipeline multiagente onde cada tarefa usa o menor modelo confiável para seu contrato.

O pipeline atual continua compatível com as tarefas legadas:

- `classification`
- `classification-judge`
- `dre-narrative`
- `action-plan`

A nova camada adiciona tarefas granulares para LangGraph sem alterar o comportamento de produção nesta etapa.

## Princípios

1. **SLM first**: usar modelos pequenos por padrão.
2. **Modelo grande só em fallback/retry**: Sonnet entra quando o SLM falha ou quando a etapa é decisional demais.
3. **Regra antes de LLM**: cálculos financeiros, agregação DRE e thresholds objetivos devem ser determinísticos.
4. **Output estruturado sempre**: todo agente deve responder JSON validado por Zod.
5. **QA independente**: o revisor não deve usar o mesmo modelo do gerador sempre que possível.
6. **Shadow antes de produção**: LangGraph deve rodar em paralelo ao pipeline atual antes de publicar resultados.

## Tarefas LLM granulares

| Tarefa | Responsabilidade | Modelo primário | Fallback |
|---|---|---|---|
| `normalization` | limpar/enriquecer lançamentos | `openai/gpt-4.1-nano` | `openai/gpt-4.1-mini` |
| `clarity-judge` | avaliar clareza da descrição | `openai/gpt-4.1-nano` | `openai/gpt-4.1-mini` |
| `dre-classification` | classificar lançamento em categoria DRE | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` |
| `anomaly-detection` | detectar anomalias financeiras | `google/gemini-2.5-flash-lite` | `openai/gpt-4.1-mini` |
| `margin-diagnosis` | diagnosticar margens e drivers | `google/gemini-2.5-flash-lite` | `openai/gpt-4.1-mini` |
| `cashflow-risk` | avaliar risco de caixa com limitações explícitas | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` |
| `narrative-synthesis` | gerar 3 cards com evidência | `google/gemini-2.5-flash` | `anthropic/claude-sonnet-4-6` |
| `action-planning` | gerar plano 3 horizontes | `google/gemini-2.5-flash` | `anthropic/claude-sonnet-4-6` |
| `financial-qa-review` | revisar coerência antes de publicar | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` |

## Grafo alvo

```text
START
  ↓
load_analysis
  ↓
normalize_entries
  ↓
clarity_judge
  ↓
dre_classifier
  ↓
dre_aggregator
  ↓
parallel:
  ├─ anomaly_detector
  ├─ margin_diagnosis
  └─ cashflow_risk
  ↓
narrative_synthesizer
  ↓
action_planner
  ↓
financial_qa_reviewer
  ↓
conditional:
  ├─ publish if qa.publishable=true
  ├─ retry narrative/action once if fixable
  └─ mark needs_review if blocker
END
```

## Contratos já criados

Arquivo principal:

```text
src/monthly-analysis/schemas/agents.ts
```

Contratos atuais:

- `AgentNameSchema`
- `AgentCostSchema`
- `AgentTraceSchema`
- `AgentErrorSchema`
- `NormalizedLedgerEntrySchema`
- `ClarityResultSchema`
- `DreClassificationResultSchema`
- `AnomalySchema`
- `MarginDiagnosisSchema`
- `CashflowRiskSchema`
- `NarrativeCardDraftSchema`
- `ActionPlanDraftSchema`
- `QaReviewSchema`

Estado base do futuro grafo:

```text
src/monthly-analysis/graph/state.ts
```

## Métricas de decisão por modelo

Cada modelo deve ser comparado por tarefa usando:

- `schema_success_rate`
- `task_pass_rate`
- `latency_p50_ms`
- `latency_p95_ms`
- `cost_cents_per_analysis`
- `retry_rate`
- `hallucination_rate`
- `human_review_rate`

## Gates mínimos

### Classificação DRE

- `schema_success_rate >= 99%`
- `accuracy_clear >= 90%`
- `accuracy_overall >= 85%`
- `ambiguous_to_review >= 95%`

### Narrativa

- sempre 3 cards
- cada card com pelo menos uma evidência numérica ou referência de evidência
- zero afirmação sem base no DRE/diagnósticos
- `pass_rate >= 90%`

### Plano de ação

- pelo menos 3 ações de curto prazo
- pelo menos 1 ação de médio prazo
- pelo menos 1 ação de longo prazo
- toda ação com `doneWhen`
- toda ação com `evidenceRefs`
- toda ação com `confidence`

### QA financeiro

- detectar pelo menos 90% dos erros plantados
- `false_block_rate <= 10%`
- nenhuma análise autônoma deve publicar sem `publishable=true`

## Evals necessários

Estrutura sugerida:

```text
evals/monthly-analysis/
├── classification/
├── clarity-judge/
├── anomaly-detection/
├── margin-diagnosis/
├── cashflow-risk/
├── narrative-synthesis/
├── action-planning/
└── qa-review/
```

Pacote mínimo inicial:

- 30 casos de classificação
- 15 casos de narrativa
- 15 casos de plano de ação
- 10 casos adversariais para QA

## Roadmap

### Sprint 1 — Foundation

- expandir `LlmTask`
- adicionar rotas agentic no router
- criar schemas Zod
- criar `MonthlyAnalysisState`
- documentar plano
- manter testes/build passando

### Sprint 2 — Classification split

- extrair `clarity-judge.agent.ts`
- extrair `dre-classifier.agent.ts`
- aplicar cap de confiança
- criar evals de classificação
- benchmark de SLMs

### Sprint 3 — LangGraph MVP

- criar grafo com comportamento equivalente ao pipeline atual
- rodar em shadow
- registrar custo por agente

### Sprint 4 — Financial diagnosis agents

- implementar `anomaly-detection`
- implementar `margin-diagnosis`
- implementar `cashflow-risk`

### Sprint 5 — QA gate

- implementar `financial-qa-review`
- retry condicional
- bloquear publicação insegura com `needs_review`

### Sprint 6 — Model matrix

- rodar matriz de modelos por tarefa
- gerar `docs/monthly-analysis/model-selection.md`
- fixar primários/fallbacks com base nos resultados

## Observação de compatibilidade

Esta etapa é deliberadamente aditiva. O pipeline BullMQ atual deve continuar usando as tarefas legadas até que o LangGraph rode em shadow e passe nos gates.
