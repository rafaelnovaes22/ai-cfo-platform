---
adr_id: "002"
title: "Estratégia de modelo LLM por task — Vertex AI Gemini default + framework de benchmarking"
status: "aceita"
constitution_version: "0.3.0"
created_at: "2026-05-12"
last_updated: "2026-06-22"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C3, C6, C7]
related_adrs: ["001", "009", "010", "019"]
---

# ADR-002 — Estratégia de modelo LLM por task + framework de benchmarking

> **Status**: ⏳ Proposta
> **Data proposta**: 2026-05-12
> **Decisor**: CEO + Tech Lead
> **Bloqueia**: promoção da Onda 1 para ASSISTED (Gate 2 de `/acme:promote` exige `recalc_unit_economics_required` resolvido)
> **Princípios Constitution afetados**: C3 (custo ≤ 25% do preço), C6 (telemetry-by-default), C7 (portability over lock-in)

---

## 1. Contexto

### 1.1. Divergência detectada

ADR-001 declarou stack default como **Anthropic SDK (Sonnet 4.6 / Opus 4.7)**. A implementação evoluiu para **Google Vertex AI Gemini 2.5 Pro/Flash** como provider primário (ADR-009/019) em:

- `classification` — Gemini 2.5 Flash (categorização DRE em categorias padrão)
- `dre-narrative` — Gemini 2.5 Pro (3 cards de narrativa)
- `action-plan` — Gemini 2.5 Pro (geração de ações 3-horizontes)

OpenAI `gpt-4.1-mini` é o **fallback canônico** (ADR-010) via `src/llm/router.ts`, acionado quando o adapter Google falha. Anthropic SDK continua disponível como adapter adicional (C7), mas não é fallback padrão.

O review AIOS de 2026-05-12 levantou isso como BLOCKER do `action-plan` ("divergência de modelo afeta C3 sem ADR"). Esta ADR é a resposta a esse BLOCKER.

### 1.2. Razões que motivaram a escolha do Gemini Flash

Em ordem de peso na decisão:

1. **Custo por outcome** — Gemini 2.5 Flash é ~5× mais barato que Sonnet 4.6 em tokens de output, ~10× mais barato em input. Para 62 lançamentos reais testados, o pipeline completo (classification + narrative + action-plan) custou < R$ 0,30 em 2026-05-11 (vs. ~R$ 1,80 estimado com Sonnet). Espaço maior para fechar C3 (custo ≤ 25% do preço) com o ticket de mensalidade pretendido para PMEs (R$ 200–500/mês).
2. **Latência** — Flash entrega narrativa de 3 cards em < 8s; Sonnet leva ~25s na mesma task. UX self-serve do Aicfo pressupõe "<5 min" para o relatório mensal — orçamento de latência é apertado.
3. **JSON mode confiável** — Gemini Flash tem `responseMimeType: "application/json"` nativo desde 2.0, com schema constraint. Reduz parsing-error sem custo de fence-stripping.
4. **Janela de contexto** — 1M tokens permite passar todo o histórico de meses anteriores do tenant em prompt único sem RAG — útil em `dre-narrative` para "compare com o mês anterior".

### 1.3. Razões para repensar em janelas específicas

1. **LGPD / inferência local** — Gemini hoje é Google AI Studio (nuvem externa, dados podem ser usados para treino). Antes de qualquer cliente real assinar, é obrigatório migrar para **Vertex AI** (mesma família, dados não usados para treino) ou substituir por modelo local (memory: "Fase 3 — Llama 3.1 8B fine-tuned, inferência 100% local"). Decisão já registrada em memory; esta ADR não a substitui, apenas conecta.
2. **Qualidade em raciocínio multi-passo** — para tasks de `decision-engine` e `scenarios` (Onda 3), Flash pode ser insuficiente. Benchmarking obrigatório antes de promover essas waves.
3. **Lock-in operacional** — `src/llm/router.ts` e os adapters absorvem o provider, mas prompts são afinados ao tom Gemini. Trocar de modelo exige re-tuning de prompts, não só de adapter (C7 técnica está OK; C7 econômica precisa de eval suite).

---

## 2. Decisão

### 2.1. Estado atual congelado (Onda 1)

**Escolhido para Onda 1:**

| Task | Modelo primário | Fallback | Justificativa |
|---|---|---|---|
| `classification` | Vertex AI Gemini 2.5 Flash | OpenAI gpt-4.1-mini | Volume alto (centenas de lançamentos/análise); accuracy ≥0.95 atingida nos testes |
| `dre-narrative` | Vertex AI Gemini 2.5 Pro | OpenAI gpt-4.1-mini | 3 cards estruturados, raciocínio leve; latência crítica |
| `action-plan` | Vertex AI Gemini 2.5 Pro | OpenAI gpt-4.1-mini | Geração estruturada de itens; raciocínio médio mas previsível |

Não há mudança de código necessária; esta ADR ratifica o estado existente.

**Alternativas descartadas para Onda 1:**

- **Sonnet 4.6 como primário**: 5–10× mais caro; viola C3 com folga insuficiente para crescer
- **Haiku 4.5 como primário**: mais barato que Flash mas perde no `dre-narrative` em narrativa contextual longa (qualidade subjetiva inferior em testes)
- **Local-only (Llama 3 8B)**: não há fine-tune ainda; categorização em 23 classes fica abaixo de 0.85 accuracy em zero-shot

---

### 2.2. Framework de benchmarking — quando e como re-avaliar

Esta é a parte vinculante desta ADR. **O modelo de cada task será re-avaliado** sempre que um dos triggers abaixo disparar. A decisão de troca é mecânica (depende do resultado do benchmark), não política.

#### 2.2.1. Triggers de re-avaliação

| Trigger | Quando dispara | Quem aciona |
|---|---|---|
| **Nova wave habilitada** | Antes de qualquer módulo de Onda 2+ entrar em SHADOW | Tech Lead via `/acme:plan` |
| **Drift de custo** | Cost-per-outcome real > 1.3× projetado em 2 meses consecutivos (audit mensal) | Audit / DeepAgent reviewer |
| **Drift de qualidade** | agreement_rate (SHADOW) ou approval_rate (ASSISTED) cai > 5pp em janela de 30 dias | Audit / DeepAgent reviewer |
| **Lançamento de modelo relevante** | Provider primário ou conhecido lança modelo com mudança ≥1 ordem de grandeza em preço ou janela ou capability | Tech Lead (manual) |
| **Mudança regulatória** | LGPD/GDPR exige inferência local ou Vertex AI antes de cliente real | CEO |
| **Mudança de ICP** | Spec do SKU passa a exigir capability que Flash não tem (raciocínio matemático complexo, agentic tool use, etc.) | PO Guardian |

#### 2.2.2. Eval suite obrigatória por task

Antes de promover qualquer task para um modelo novo, a task precisa ter **eval suite ≥30 casos** (C4 hard gate) cobrindo:

- ≥10 casos por outcome declarado na spec do módulo
- Mix de fontes: real ≥40%, synthetic ≤40%, edge ≥10%, adversarial ≥10%
- Ground-truth com justificativa (não "Claude disse que sim")

A eval suite vive em `evals/{module}/cases/` e é executada via `/acme:eval --module {module} --model {candidate}`.

#### 2.2.3. Métricas do benchmark (vetor de avaliação)

Cada modelo candidato é medido nos 5 eixos abaixo. **Nenhum eixo é dispensável** — um modelo que ganha em 4 e perde catastroficamente em 1 não é escolhido.

| Eixo | Métrica | Como medir | Limite mínimo |
|---|---|---|---|
| **Qualidade** | pass_rate da eval suite | execução automática do `/acme:eval` | ≥ baseline atual − 1pp |
| **Latência p95** | tempo entre prompt enviado e response completo | telemetria LangSmith | dre-narrative ≤ 15s; classification batch ≤ 30s; action-plan ≤ 30s |
| **Custo por outcome** | (input_tokens × $in + output_tokens × $out) × R$/USD | telemetria LangSmith + tabela de preços | ≤ 25% do preço do plano (C3) |
| **Determinismo** | variância em 5 reruns do mesmo caso (temperature=0) | execução repetida do eval | < 5% mudança no diff de strings críticos |
| **Compliance** | inferência local OU residência de dados garantida pelo provider | leitura do contrato/SLA do provider | obrigatório antes de ASSISTED |

#### 2.2.4. Processo de troca de modelo

```
1. Trigger dispara → Tech Lead abre RFC: "Benchmark de {model_candidate} para {task}"
2. RFC vinculado a esta ADR; estende seção §3.1 deste documento
3. Eval suite executada via /acme:eval para baseline (modelo atual) e candidato
4. Resultados publicados em docs/benchmarks/{YYYY-MM}-{task}.md
5. Se candidato ≥ baseline em TODOS os 5 eixos → atualizar src/llm/router.ts
6. Se candidato perde em ≥1 eixo → manter baseline + documentar tradeoff
7. Toda mudança em src/llm/router.ts dispara recalc_unit_economics_required
   (Gate 2 do /acme:promote) → docs/onda-N/unit_economics.md re-validada
```

#### 2.2.5. Modelos candidatos pré-mapeados

Lista não-exaustiva; benchmarks pontuais podem incluir outros. Atualização desta tabela é dispensa de ADR nova — apenas commit em `docs/benchmarks/`.

| Modelo | Quando faz sentido testar | Custo relativo vs Flash 2.5 | Observação |
|---|---|---|---|
| **Gemini 2.5 Pro** | Onda 3 (decision-engine, scenarios) — raciocínio multi-passo | ~5× | Mesmo provider; troca trivial via router |
| **OpenAI gpt-4.1-mini** | Diversificação de provider + fallback canônico | similar a Flash | Fallback ativo em `src/llm/router.ts` |
| **Claude Haiku 4.5** | Classification — disputar custo com qualidade similar | ~1.5× | Adapter disponível; não é fallback padrão |
| **Claude Sonnet 4.6** | Tasks onde qualidade > custo (ex: anomaly detection) | ~8× | Adapter disponível |
| **Claude Opus 4.7** | Casos extremos de raciocínio (audit, fraud) | ~25× | Reservado para Onda 7 (anomaly-fraud-detection) |
| **Llama 3.1 8B fine-tuned local** | LGPD obrigatório + fine-tune disponível | ~0.1× (custo de infra) | Fase 3 do roadmap; exige dataset de fine-tune |
| **Qwen 2.5 7B fine-tuned local** | Alternativa a Llama; melhor em pt-BR em alguns benchmarks | ~0.1× | Fase 2 conforme memory |
| **Vertex AI Gemini** | LGPD pre-ASSISTED (dados não usados para treino) | igual ao Studio | **Adotado** em 2026-06 (ADR-009/019); mesmo prompt |

---

### 2.3. Modelo "advisory" no `target_model_advisory` da spec

Para evitar que cada spec amarre a stack, a partir desta ADR:

- Specs declaram `target_model_advisory: "gemini-2.5-flash"` (ou candidato sugerido) como **sugestão**, não decisão
- A decisão real fica em `src/llm/router.ts` e é controlada por ADRs (esta ou futuras)
- Quando uma spec sugerir modelo diferente do router atual, isso dispara obrigatoriamente o framework §2.2 antes de mudar o router

---

## 3. Consequências

### 3.1. Positivas

- **C3 (custo ≤ 25%)** factível com Gemini Flash em Onda 1 — confirmação requer recalcular unit economics em `docs/onda-0/unit_economics.md`
- **C7 (portability)** reforçado: router absorve o provider; ADR define quando trocar; benchmarks são auditáveis
- **C6 (telemetry)** ganha utilidade: telemetria LangSmith já estava lá; agora os triggers automáticos de re-avaliação consomem essa telemetria
- Decisão de modelo deixa de ser política (quem prefere o quê) e vira mecânica (quem passa nos 5 eixos)

### 3.2. Negativas

- Eval suites são pré-requisito — Onda 1 hoje tem 0 evals. Sem elas, esta ADR é decorativa
- Cada troca de modelo dispara recalc de unit economics (~1 dia de trabalho por SKU)
- Prompts hoje afinados ao tom Gemini — troca para Claude pode exigir re-tuning manual (não automatizável)

### 3.3. Reversibilidade

- **Alta** para troca *dentro* do framework (`src/llm/router.ts` é o único arquivo afetado por troca de modelo entre providers já adaptados — Google, Anthropic, local)
- **Média** para adicionar novo provider (precisa novo adapter em `src/llm/adapters/`)
- **Baixa** para LGPD: migração para Vertex/local é one-way — uma vez feita, voltar para Studio é regressão

---

## 4. NÃO faz parte desta decisão

- ❌ Trocar o provider para Onda 1 *agora* — Gemini Flash fica até trigger §2.2.1 disparar
- ❌ Decidir Vertex AI vs Llama local — outra ADR quando houver cliente real assinando
- ❌ Definir o conteúdo de cada eval suite — escopo do `/acme:eval` por módulo (Onda C dos fixes)
- ❌ Decidir preço final do SKU — dependente de unit economics recalculado, escopo `docs/onda-0/unit_economics.md`

---

## 5. Aprovação

- [x] CEO leu e aprovou (eval framework + triggers)
- [x] Tech Lead leu e aprovou (modelos candidatos + reversibilidade)
- [x] Unit Economist validou §3.1 (recalc com Vertex AI Gemini → C3 OK)
- [x] ADR commitada em `docs/adr/002-llm-model-strategy.md`

**Decisão final em**: 2026-06-22

---

## 6. Histórico

| Data | Mudança | Autor |
|---|---|---|
| 2026-05-12 | Proposta inicial — formaliza Gemini Flash + framework de benchmarking | Rafael Novaes |
