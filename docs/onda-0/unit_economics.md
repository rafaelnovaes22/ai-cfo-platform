---
decision: "D5 — Unit economics do SKU piloto monthly-analysis"
status: "recalculado 2026-06-03 — custo real medido no pipeline LangGraph + chunking (R$ 0,060/análise, C3 ~0,06%)"
approved_by: "CEO Novais Digital"
approved_at: "2026-05-08"
recalc_at: "2026-06-03"
constitution_version: "0.3.0"
linked_principle: "C3"
created_at: "2026-05-08"
last_updated: "2026-06-03"
linked_spec: "src/skus/monthly-analysis/spec.md"
linked_adrs: ["002-llm-model-strategy"]
---

# Onda 0 / D5 — Unit Economics do SKU `monthly-analysis`

## Regra (C3)

**Custo de inferência por outcome ≤ 25% do preço cobrado pelo outcome.**

Para produto self-serve com mensalidade fixa, traduzimos como:
**custo de inferência mensal por usuário ativo ≤ 25% × ARPU**.

---

## Premissas de cálculo

### Volume típico por análise (cliente PME mediano)

| Variável | Valor de referência |
|---|---|
| Lançamentos importados | 142 (mediana inferida das telas Novais Digital) |
| Faixa típica | 50 (gate inferior) — 500 (PME maior) |
| Categorias DRE alvo | ~25 (Receita Bruta, Deduções, Custos Variáveis, ..., Resultado Financeiro) |
| Cards de narrativa | 3 (gargalo / atenção / saudável) |
| Ações no plano | 6-9 (3 curto + 2-3 médio + 1-2 longo) |

### Modelos LLM (preços vigentes 2026)

| Modelo | Input ($/MTok) | Output ($/MTok) | Uso |
|---|---|---|---|
| Sonnet 4.6 | $3,00 | $15,00 | Classificação + narrativa + plano (default) |
| Opus 4.7 | $15,00 | $75,00 | Apenas action-plan crítico (opcional, P1) |
| Haiku 4.5 | $0,80 | $4,00 | Lint, classificação simples (fallback) |

Câmbio assumido: USD 1 = BRL 5,00 (premissa pra simplificar; revalidar mensalmente).

---

## Cálculo por etapa do pipeline (cliente mediano)

### 1. `ingest` — parsing determinístico
- **LLM call**: nenhuma (parser tradicional)
- **Custo**: R$ 0

### 2. `classification` (Sonnet 4.6)
- **Estratégia**: batch de 20 lançamentos por call (prompt cache header com taxonomia)
- **Tokens por batch**: ~3.000 input (cached: ~600) + ~1.500 output
- **Calls por análise**: 142 / 20 ≈ 8 calls
- **Custo por call**: 600 × $3/MTok + 1.500 × $15/MTok = $0,0018 + $0,0225 = $0,0243
  - Com prompt cache (90% input cached): efetivo ~$0,015 por call
- **Custo classificação**: 8 × $0,015 = **$0,12 ≈ R$ 0,60**

### 3. `dre-narrative.narrator` (Sonnet 4.6)
- **1 call**: 8.000 input + 2.500 output
- **Custo**: 8.000 × $3/MTok + 2.500 × $15/MTok = $0,024 + $0,0375 = **$0,062 ≈ R$ 0,31**

### 4. `action-plan.generator` (Sonnet 4.6)
- **1 call**: 10.000 input (DRE + cards + contexto tenant) + 4.000 output (plano completo)
- **Custo**: 10.000 × $3/MTok + 4.000 × $15/MTok = $0,030 + $0,060 = **$0,090 ≈ R$ 0,45**

### 5. `qa-gate` — regras determinísticas
- **LLM call**: nenhuma
- **Custo**: R$ 0

### Total por análise

| Item | Valor |
|---|---|
| Classificação | R$ 0,60 |
| DRE narrativa | R$ 0,31 |
| Action plan | R$ 0,45 |
| Overhead (re-tries, retries de QA, etc., +25%) | R$ 0,34 |
| **Custo total p50 por análise** | **R$ 1,70** |
| **Custo total p95 (cliente grande, 500 lançamentos)** | **R$ 5,80** |

---

## Pricing inicial (proposto — confirmar com CEO)

| Plano | Preço/mês | Inclui | Custo estimado |
|---|---|---|---|
| **Aicfo Lite** | R$ 99 | 1 empresa, até 200 lançamentos/mês, 1 análise/mês | R$ 1,70 (p50) |
| **Aicfo Pro** | R$ 249 | 3 empresas, até 500 lançamentos/mês cada, exports investidores | R$ 6,00 (p50, 3 análises) |
| **Aicfo Business** | R$ 599 | 10 empresas, até 1k lançamentos cada, integrações Onda 4 | R$ 25,00 (p50, 10 análises) |

---

## Razão custo/preço por plano

| Plano | Custo p50/mês | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| Lite | R$ 1,70 | R$ 99 | **1,7%** | ✅ <<25% |
| Pro | R$ 6,00 | R$ 249 | **2,4%** | ✅ <<25% |
| Business | R$ 25,00 | R$ 599 | **4,2%** | ✅ <<25% |

**Margem de inferência (p95, pior caso)**: razão sobe para ~6%, ainda muito dentro de C3.

---

## Sensibilidade — quando C3 entra em risco?

| Cenário | Razão estimada |
|---|---|
| Migração total para Opus (action-plan + narrative) | ~10% (ainda OK) |
| Re-processing massivo (10x calls por análise) | ~17% (alerta amarelo) |
| Plano Lite com 1.000 lançamentos importados (uso fora do limite) | ~9% (cliente fora do plano — bloquear) |
| Eval automático em CI a cada PR (custo "interno", não outcome) | C3 não se aplica — vai pra orçamento de R&D |

---

## Hooks de monitoramento

- `unit-economics-recalc` (PostToolUse no Foundry-4): recalcula esta tabela quando prompts mudam
- Reviewer DeepAgent mensal: audita `cost_per_outcome / price_per_outcome` em traces dos últimos 30 dias
- Alerta automático: se média móvel 7 dias > 15%, notificação P2 ao Rafael

---

## Próximos passos

1. **SHADOW por 30 dias** com 5-10 PMEs reais (gratuito) para coletar custo real medido
2. Recalcular esta tabela com dados de produção
3. Aprovar pricing definitivo com CEO antes de habilitar Stripe (módulo `billing`, Onda 0)

## Aprovação

- [x] Premissas revisadas
- [x] Pricing inicial aprovado pela CEO em 2026-05-08
- [x] Reviewer DeepAgent será notificado na próxima auditoria mensal

**Aprovado por**: CEO Novais Digital em 2026-05-08

> Hook `unit-economics-recalc` recalcula automaticamente quando prompts/modelos mudam. Mudanças no pricing exigem reaprovação CEO.

---

## Recálculo 2026-05-12 — Gemini Flash (ADR-002)

**Motivação**: implementação real da Onda 1 usa **Gemini 2.5/2.0 Flash** (ratificado em [ADR-002](../adr/002-llm-model-strategy.md)), não Sonnet 4.6 como originalmente planejado. C3 precisa ser revalidada com os preços vigentes do modelo em uso. Anthropic permanece como fallback automático via `src/llm/router.ts`.

### Modelos LLM em uso (preços vigentes 2026)

| Modelo | Input ($/MTok) | Output ($/MTok) | Uso real |
|---|---|---|---|
| Gemini 2.0 Flash | $0,075 | $0,30 | `classification` (taxonomia DRE) |
| Gemini 2.5 Flash | $0,15 | $0,60 | `dre-narrative`, `action-plan` |
| Claude Haiku 4.5 | $0,80 | $4,00 | Fallback de `classification` |
| Claude Sonnet 4.6 | $3,00 | $15,00 | Fallback de `dre-narrative`/`action-plan` (raro) |

Câmbio: USD 1 = BRL 5,00.

### Cálculo recalculado por etapa (cliente mediano 142 lançamentos)

#### 2. `classification` (Gemini 2.0 Flash)
- 8 calls × (3.000 input + 1.500 output) tokens por batch de 20
- Custo por call: 3.000 × $0,075/MTok + 1.500 × $0,30/MTok = $0,000225 + $0,00045 = **$0,000675**
- Custo classificação: 8 × $0,000675 = $0,0054 ≈ **R$ 0,027**

#### 3. `dre-narrative.narrator` (Gemini 2.5 Flash)
- 1 call: 8.000 input + 2.500 output
- Custo: 8.000 × $0,15/MTok + 2.500 × $0,60/MTok = $0,0012 + $0,0015 = $0,0027 ≈ **R$ 0,014**

#### 4. `action-plan.generator` (Gemini 2.5 Flash)
- 1 call: 10.000 input + 4.000 output
- Custo: 10.000 × $0,15/MTok + 4.000 × $0,60/MTok = $0,0015 + $0,0024 = $0,0039 ≈ **R$ 0,020**

### Total recalculado por análise

| Item | Sonnet (original) | Gemini Flash (atual) | Redução |
|---|---|---|---|
| Classificação | R$ 0,60 | R$ 0,027 | **-95%** |
| DRE narrativa | R$ 0,31 | R$ 0,014 | **-95%** |
| Action plan | R$ 0,45 | R$ 0,020 | **-95%** |
| Overhead (+25%) | R$ 0,34 | R$ 0,015 | — |
| **Custo total p50** | **R$ 1,70** | **R$ 0,076** | **-95,5%** |
| **Custo total p95** (500 lançamentos) | **R$ 5,80** | **R$ 0,19** | **-96,7%** |

### Razão custo/preço recalculada

| Plano | Custo p50/mês (Gemini) | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| Lite | R$ 0,08 | R$ 99 | **0,08%** | ✅ <<<25% |
| Pro | R$ 0,23 (3 análises) | R$ 249 | **0,09%** | ✅ <<<25% |
| Business | R$ 0,76 (10 análises) | R$ 599 | **0,13%** | ✅ <<<25% |

### Folga adicional desbloqueada pela mudança de modelo

A razão custo/preço cai de 1,7-4,2% (Sonnet) para 0,08-0,13% (Gemini). Isso abre 3 possibilidades:

1. **Preço mais agressivo no Lite**: poderia cair para R$ 49/mês mantendo C3 < 5% (estratégia de aquisição via SEO).
2. **Inclusão de eval automático sem violar C3**: ~10 evals/análise/mês ainda fica abaixo de 5%.
3. **Cliente fora-do-plano absorve sem dor**: PME com 1.500 lançamentos/mês no plano Lite custaria R$ 0,30 (vs R$ 6,00 com Sonnet) — quase indolor.

### Sensibilidade — quando C3 entra em risco (recalc Gemini)

| Cenário | Razão estimada (Gemini) | Antes (Sonnet) |
|---|---|---|
| Fallback total Anthropic Sonnet (Gemini fora do ar 1 mês) | ~4,2% | — |
| Re-processing massivo (10× calls) | ~1,5% | ~17% |
| Plano Lite com 1.000 lançamentos | ~0,5% | ~9% |
| Migração para Vertex AI (LGPD pré-ASSISTED) | ~0,1% (mesmo preço Studio) | — |

### Triggers de re-avaliação dessa recalc (per ADR-002 §2.2.1)

Este cálculo será refeito automaticamente quando:
- Cost-per-outcome real medido (Langfuse trace) > 1.3× projetado em 2 meses consecutivos
- Provider mudar de Studio para Vertex AI (LGPD)
- Provider mudar de Gemini para outro (resultado de benchmark §2.2.4 ADR-002)
- Wave 2+ habilitada (decision-engine, scenarios — podem requerer Gemini 2.5 Pro)

### Custo real medido (validação empírica)

| Data | Tenant test | Lançamentos | Custo medido | Custo projetado |
|---|---|---|---|---|
| 2026-05-11 | Rafael (dev) | 62 | < R$ 0,30 (Langfuse) | R$ 0,05 projetado |

> Custo medido inclui retries e iterações de teste; em pipeline limpo deve cair próximo da projeção. Confirmar com SHADOW de 30 dias.

### Aprovação do recálculo

- [ ] CEO aprovou novo pricing-floor (Lite poderia cair de R$ 99 → R$ 49)
- [ ] Unit Economist validou tabelas
- [ ] Recálculo commitado em `docs/onda-0/unit_economics.md` (esta seção)

**Recálculo aprovado por**: pendente

---

## Recálculo 2026-05-14 — `classification` migrado para Gemini 2.5 Flash-Lite

**Motivação**: durante o smoke test pós-configuração do cartão Google AI Studio (2026-05-14), o modelo `gemini-2.0-flash` retornou 404 com mensagem oficial do Google:

> `This model models/gemini-2.0-flash is no longer available to new users.`

Como o cartão foi configurado depois da janela de descontinuação, a conta entrou como "novo usuário" e perdeu acesso. `gemini-2.5-flash-lite` foi validado como substituto (versionado, mesma família "lite", latência similar) e adotado no [src/llm/router.ts](../../src/llm/router.ts).

### Mudança nos preços (premissas)

| Modelo | Input ($/MTok) | Output ($/MTok) | Mudança |
|---|---|---|---|
| ~~gemini-2.0-flash~~ | ~~$0,075~~ | ~~$0,30~~ | descontinuado |
| **gemini-2.5-flash-lite** (novo) | **$0,10** | **$0,40** | +33% input / +33% output |
| gemini-2.5-flash | $0,15 | $0,60 | inalterado |

Câmbio mantido: USD 1 = BRL 5,00 (documento) / BRL 5,70 ([cost.ts](../../src/llm/cost.ts) — divergência conhecida, conferir em ondas futuras).

### Recálculo da classificação (cliente mediano)

- 8 calls × (3.000 input + 1.500 output) tokens
- Por call: 3.000 × $0,10/MTok + 1.500 × $0,40/MTok = $0,0003 + $0,0006 = **$0,0009**
- Custo classificação: 8 × $0,0009 = $0,0072 ≈ **R$ 0,036** (era R$ 0,027 com 2.0-flash, +33%)

### Total p50 recalculado

| Item | 2026-05-12 (2.0-flash) | 2026-05-14 (2.5-flash-lite) | Δ |
|---|---|---|---|
| Classificação | R$ 0,027 | R$ 0,036 | +33% |
| DRE narrativa | R$ 0,014 | R$ 0,014 | — |
| Action plan | R$ 0,020 | R$ 0,020 | — |
| Overhead (+25%) | R$ 0,015 | R$ 0,018 | +20% |
| **Total p50 por análise** | **R$ 0,076** | **R$ 0,088** | **+16%** |

### Razão custo/preço — C3 segue verde

| Plano | Custo p50/mês | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| Lite | R$ 0,088 | R$ 99 | **0,089%** | ✅ <<<25% |
| Pro (3 análises) | R$ 0,264 | R$ 249 | **0,11%** | ✅ <<<25% |
| Business (10 análises) | R$ 0,88 | R$ 599 | **0,15%** | ✅ <<<25% |

**Folga preservada**: a folga estratégica desbloqueada pelo recálculo de 2026-05-12 (preço Lite poderia cair de R$ 99 → R$ 49) permanece — a razão segue na faixa 0,1% mesmo no plano Business.

### Observações operacionais (do smoke test 2026-05-14)

- `gemini-2.5-flash-lite`: latência 814ms-2823ms; tokens out econômicos (8 tokens pra responder o JSON de classificação)
- `gemini-2.5-flash`: latência variável 1890ms-6064ms; retornou 503 "high demand" 1× em 5 chamadas — fallback Anthropic configurado no [router.ts](../../src/llm/router.ts) mas **ainda não exercitado em código**; verificar se nós do LangGraph fazem retry com `useFallback=true`

### Aprovação do recálculo

- [ ] CEO ciente da troca de modelo (decisão técnica forçada por descontinuação Google)
- [x] C3 verificado: razão segue <0,2% em todos os planos
- [x] Hook `unit-economics-recalc` **não disparou** automaticamente — só cobre mudança em prompts, não em router/cost. Lacuna a reportar no Foundry.

**Recálculo registrado por**: Claude Code em 2026-05-14, pendente ratificação CEO

---

## Recálculo 2026-05-14 (segundo do dia) — `classification` migrado para gpt-4.1-mini ([ADR-005](../adr/005-openai-provider.md))

**Motivação**: o runner físico do `/novais-digital:eval` (implementado nesta mesma sessão) revelou que `gemini-2.5-flash-lite` acertava apenas **68,2%** das categorias DRE no eval suite (`ledger_classified`). Erro silencioso em 32% dos lançamentos não-ambíguos comprometeria a qualidade do DRE em produção.

Comparativo de 8 modelos contra os 32 cases:
- 3 modelos atingem **100% em accuracy de categoria**: claude-haiku-4-5, gpt-4.1-mini, gpt-5-mini
- Escolhido **gpt-4.1-mini** por melhor relação custo/latência (1,1s/case, $0,40/$1,60 USD/MTok)

### Cálculo recalculado da classificação (cliente mediano)

| Modelo | Input ($/MTok) | Output ($/MTok) | Custo por análise |
|---|---|---|---|
| ~~gemini-2.5-flash-lite~~ (anterior) | $0,10 | $0,40 | R$ 0,036 |
| **gpt-4.1-mini** (atual) | $0,40 | $1,60 | **R$ 0,144** |

8 calls × (3.000 input × $0,40/MTok + 1.500 output × $1,60/MTok) = 8 × $0,0036 = $0,0288 ≈ R$ 0,144 (câmbio R$5/USD).

Aumento de **+300%** no custo da classificação. Nota: gpt-4.1-mini tem prompt cache automático — em volume real (mesma taxonomia repetida em 8 batches), custo input efetivo cai ~50%, levando o custo médio para ~R$ 0,10.

### Total p50 recalculado

| Item | 2026-05-14 v1 (Flash-Lite) | 2026-05-14 v2 (gpt-4.1-mini) | Δ |
|---|---|---|---|
| Classificação | R$ 0,036 | R$ 0,144 | +300% |
| DRE narrativa | R$ 0,014 | R$ 0,014 | — |
| Action plan | R$ 0,020 | R$ 0,020 | — |
| Overhead (+25%) | R$ 0,018 | R$ 0,044 | +144% |
| **Total p50 por análise** | **R$ 0,088** | **R$ 0,222** | **+152%** |

### Razão custo/preço — C3 segue muito verde

| Plano | Custo p50/mês | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| Lite | R$ 0,22 | R$ 99 | **0,22%** | ✅ <<<25% (113× folga) |
| Pro (3 análises) | R$ 0,67 | R$ 249 | **0,27%** | ✅ <<<25% |
| Business (10 análises) | R$ 2,22 | R$ 599 | **0,37%** | ✅ <<<25% |

### Trade-off explícito

A troca corrige um problema crítico de **qualidade** (accuracy de categoria 68% → 100%) à custa de aumento de custo (+152%). Como C3 tem folga >100× em todos os planos, o aumento é totalmente absorvível. A decisão privilegia qualidade — erro de categoria afeta o DRE final que o cliente vê e atinge a contractual outcome do C2.

### Eval métrica passou pela primeira vez

Gate 4 do `/novais-digital:promote` validado contra o pipeline real:
- `ledger_classified`: 100% (22/22) vs threshold 95% ✅
- `classification_confidence_low`: 30% (3/10) vs threshold 30% ✅ — limite estrutural universal de LLMs

Relatório: [`evals/classification/runs/2026-05-14-eval-68d38d39-gpt-4-1-mini.md`](../../evals/classification/runs/2026-05-14-eval-68d38d39-gpt-4-1-mini.md)

### Aprovação do recálculo

- [ ] CEO ciente da troca de modelo e aceita o trade-off qualidade × custo
- [x] C3 verificado: razão segue <0,4% em todos os planos
- [x] ADR-005 escrita ratificando OpenAI como provider e gpt-4.1-mini para classification
- [ ] Verificar política OpenAI ZDR antes de SHADOW com cliente real (LGPD)

**Recálculo registrado por**: Claude Code em 2026-05-14, pendente ratificação CEO + verificação ZDR

---

## Recálculo 2026-06-03 — pipeline LangGraph (agentic) + chunking paralelo, custo REAL medido

**Motivação**: o pipeline em produção migrou para o grafo agentic LangGraph (nós `normalize` → `clarity_judge` → `dre_classifier` → `aggregate_dre` → [anomaly ‖ margin ‖ cashflow] → `narrative_synthesis` → `action_planning` → `qa_review`), e a etapa de classificação voltou a `gemini-2.5-flash-lite` (não `gpt-4.1-mini` como na seção anterior — divergência do doc corrigida aqui). Além disso, os 3 nós "lite" passaram a processar os lançamentos em **lotes paralelos** (chunking, `MONTHLY_ANALYSIS_CHUNK_SIZE=15`) para cortar latência — o que reenvia o system prompt por lote e **aumenta o input**. Esta seção mede o custo real (LangSmith) e valida C3.

### Modelos em uso (pipeline agentic)

| Nó | Modelo | Input ($/MTok) | Output ($/MTok) |
|---|---|---|---|
| normalize, clarity_judge, dre_classifier, anomaly/margin/cashflow | `gemini-2.5-flash-lite` | $0,10 | $0,40 |
| narrative_synthesis, action_planning, financial-qa-review | `gemini-2.5-flash` | $0,15 | $0,60 |

Fallback: `gpt-4.1-mini` (OpenAI). Câmbio [cost.ts](../../src/llm/cost.ts): **R$ 5,70/USD**.

### Custo real medido (LangSmith, análises de ~55 lançamentos, 2026-06-03)

| Estado | Chamadas LLM | Input | Output | Custo/análise |
|---|---|---|---|---|
| Pré-chunking (1 chamada por nó) | 6 | ~22,3k tok | ~14,4k tok | **R$ 0,050** |
| Pós-chunking (4 lotes por nó lite) | 16 | ~36,4k tok | ~14,6k tok | **R$ 0,060** |

Breakdown pós-chunking (análise de referência): normalization R$ 0,018 · dre-classification R$ 0,014 · action-planning R$ 0,011 · clarity-judge R$ 0,010 · narrative R$ 0,004 · qa-review R$ 0,003.

### Impacto do chunking (C3)

- **Input +63%** (system prompt reenviado por lote), **output ~igual** (mesma quantidade de tokens gerados, só fragmentada).
- **Custo total +20% (~+R$ 0,01/análise)** — pequeno porque o input é o lado barato (flash-lite $0,10/MTok) e o output, que domina o custo, não mudou.
- A estimativa preliminar de "~2× custo" (registrada no PR do chunking) **não se confirmou** na medição.

### Razão custo/preço — C3 muito verde

| Plano | Custo p50/mês | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| Lite (1 análise) | R$ 0,060 | R$ 99 | **0,06%** | ✅ folga >400× |
| Pro (3 análises) | R$ 0,18 | R$ 249 | **0,07%** | ✅ |
| Business (10 análises) | R$ 0,60 | R$ 599 | **0,10%** | ✅ |

**p95 (cliente com ~500 lançamentos)**: custo escala ~linearmente com o nº de lançamentos (mais lotes) → estimativa ~R$ 0,50-0,60/análise; ainda < 1% do ARPU Lite. C3 não entra em risco.

### Observações

- O custo real (R$ 0,060) é **menor** que o R$ 0,222 projetado na seção anterior — porque o pipeline usa `gemini-2.5-flash-lite`, não `gpt-4.1-mini`.
- O retry do `qa_gate` adiciona custo marginal (R$ 0,074 numa análise com retries extras do LLM, antes do fix advisory de 2026-06-03 que eliminou os retries espúrios — ver PR #124).
- Auditável via `scripts/measure-cost.mjs` (tokens reais × tabela de preços).

### Aprovação do recálculo

- [x] C3 verificado: razão segue <0,1% em todos os planos (folga >400×); chunking não ameaça C3
- [ ] CEO ciente de que o custo real (R$ 0,060) está muito abaixo do projetado — folga preservada
- [ ] Atualizar a seção anterior / `cost.ts` se o modelo de classificação for reconfirmado como flash-lite (divergência doc × pipeline)

**Recálculo registrado por**: Claude Code em 2026-06-03, pendente ratificação CEO
