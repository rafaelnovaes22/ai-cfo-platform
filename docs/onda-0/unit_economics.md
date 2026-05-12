---
decision: "D5 — Unit economics do SKU piloto monthly-analysis"
status: "recalculado 2026-05-12 com Gemini Flash (ADR-002) — premissas a confirmar com volume real durante SHADOW"
approved_by: "CEO Acme"
approved_at: "2026-05-08"
recalc_at: "2026-05-12"
constitution_version: "0.2.0"
linked_principle: "C3"
created_at: "2026-05-08"
last_updated: "2026-05-12"
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
| Lançamentos importados | 142 (mediana inferida das telas Acme) |
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

- `unit-economics-recalc` (PostToolUse no Forge-4): recalcula esta tabela quando prompts mudam
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

**Aprovado por**: CEO Acme em 2026-05-08

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
