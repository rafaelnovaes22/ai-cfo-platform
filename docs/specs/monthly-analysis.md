---
artifact_id: "monthly-analysis"
artifact_type: "product"
product_code: "monthly-analysis"
product_name: "Análise Financeira Mensal Aicfo"
category: "self-serve-product"
status: "discovery"
lifecycle_stage: "mvp"
constitution_version: "0.2.0"
spec_version: "0.2.0"
forge_command_version: "spec@0.2.0"
linked_diagnostic: "N/A — produto self-serve sem diagnóstico individual por cliente"
linked_diagnostic_status: "not_applicable"
linked_unit_economics: "docs/onda-0/unit_economics.md"
linked_baseline_cost: "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md"
linked_lifecycle: "docs/onda-0/lifecycle_monthly_analysis.md"
linked_sla_threshold: "docs/onda-0/sla_threshold.md"
linked_process_map: "docs/clients/aicfo/process-monthly-analysis-2026-05-25.md"
linked_cliente_artifacts:
  - "docs/clients/aicfo/process-monthly-analysis-2026-05-25.md"
  - "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md"
outcome_clause_hash: "3b9278b7825aaa9e"
outcome_categories:
  - "analysis_delivered"
  - "dre_classified"
  - "narrative_generated"
  - "action_plan_generated"
  - "report_exported"
c2_validation: "pass"
c8_validation: "pass"
trigger_event: "client_imports_ledger_for_reference_month"
c4_thresholds:
  signature_hash: "3a2e0f6f1f6d9644"
  signed_by: "CEO Acme"
  signed_at: "2026-05-08"
  source: "docs/onda-0/sla_threshold.md (D6 — aprovado 2026-05-08)"
  mode: "shadow"
  min_window_days: 14
  agreement_rate_min: 0.75
  narrative_quality_min: 0.70
  action_plan_quality_min: 0.60
  latency_p95_seconds: 300
  trace_coverage_min: 0.99
  cost_to_arpu_max: 0.20
  cost_per_outcome_max_cents: 1980
  human_cost_per_unit_cents: 30000
  eval_pass_rate_min: 0.90
  eval_min_cases: 30
  next_mode_promotion_window_days: 30
  next_mode_thresholds_ref: "docs/onda-0/sla_threshold.md#shadow--assisted"
target_runtime_advisory: "node-ts"
target_model_advisory: "claude-sonnet-4-6"
aios_modules:
  - ingest
  - classification
  - dre-narrative
  - action-plan
  - hub
  - export
owners:
  product_lead: "Rafael Novaes"
  tech_lead: "Rafael Novaes"
created_at: "2026-05-08"
last_updated: "2026-05-25"
canonical_migration:
  source: "src/skus/monthly-analysis/spec.md"
  migrated_at: "2026-05-25"
  reason: "Forge canonical path required for /acme:promote, /acme:plan, /acme:eval — original kept as runtime reference"
---

# Product Spec — Análise Financeira Mensal Aicfo

> SKU piloto do Aicfo. Cliente loga, importa lançamentos do mês, recebe análise narrada + plano de ação em <5 min.
>
> **Nota de migração** (2026-05-25): este arquivo é a versão canônica Forge da spec. O original em [`src/skus/monthly-analysis/spec.md`](../../src/skus/monthly-analysis/spec.md) permanece como referência inline ao código. Mudanças contratuais (cláusula de outcome, categorias, exemplos) **devem ser feitas aqui** e propagadas via PR (o hash é checado por `/acme:promote`).

---

## 1. Cláusula de outcome (C2)

### 1.1. Definição em uma frase

> O Aicfo entrega **uma análise financeira mensal** quando o cliente importa ≥ 50 lançamentos de um mês de referência, gerando: (a) DRE Facilitado classificado e narrado, (b) 3 cards de "Leitura da história" (Gargalo crítico / Atenção / Saudável), (c) Plano de Ação 3-horizontes com impacto R$ estimado por ação.

`outcome_clause_hash: 3b9278b7825aaa9e` (sha256:16 da cláusula acima — checked por `/acme:promote` gate 1 contra `prompt.outcome_clause_hash`)

### 1.2. Outcomes principais cobráveis

| # | Outcome | Definição | Frequência típica |
|---|---|---|---|
| 1 | `analysis_delivered` | Análise mensal completa entregue (DRE narrado + cards + plano) | 1 por mês por empresa |
| 2 | `dre_classified` | DRE com >90% das linhas classificadas em categorias DRE padrão | 1 por análise |
| 3 | `narrative_generated` | 3 cards de leitura (1 gargalo, 1 atenção, 1 saudável), cada um com causa + evidência numérica | 1 por análise |
| 4 | `action_plan_generated` | Plano com ≥3 ações em curto prazo + ≥1 em médio + ≥1 em longo, cada uma com (prazo, esforço, risco, impacto R$) | 1 por análise |
| 5 | `report_exported` | Análise exportada em PDF/Excel (mensal, investidores, sócios) | sob demanda (~3-5 por análise) |

### 1.3. Três exemplos POSITIVOS

| # | Cenário | Output esperado |
|---|---|---|
| 1 | Agência de marketing, 142 lançamentos importados via Excel, faturamento R$ 184k | DRE Facilitado classificado, card "Tráfego pago cresceu 47% sem retorno", plano com 3 ações curto + 2 médio prazo |
| 2 | Indústria leve, 320 lançamentos, fluxo recorrente claro | DRE com margem de contribuição calculada, cards focando em produtividade + estoque, plano com ações de redução de custos |
| 3 | Serviços B2B com MRR alto, 95 lançamentos | DRE com card "MRR representa 77% da receita — saudável", plano focando em expansão receita |

### 1.4. Três exemplos NEGATIVOS

| # | Cenário | Por que não entrega |
|---|---|---|
| 1 | Cliente importa <50 lançamentos | Amostra pequena demais para análise estatística confiável → bloqueia geração com mensagem clara |
| 2 | Lançamentos com >30% sem categoria parseável | Classificação precisa de input mínimo viável → retorna com pedido de revisão manual das linhas órfãs |
| 3 | Mês ainda em aberto (data de referência futura) | Análise é fechamento; antes do mês fechar, cliente vê dashboard em tempo real (módulo `cashflow`, Onda 2), não esta análise |

### 1.5. Termos de uso visíveis ao cliente

```
Ao gerar uma análise mensal, o cliente concorda:

Garantias:
- Análise entregue em até 10 min após import bem-sucedido (SLA p95 <5min)
- DRE classificado com ≥85% de acurácia (medido por amostra mensal)
- Cards de leitura geram inferências baseadas exclusivamente nos dados importados
- Plano de ação contém estimativas de impacto financeiro com premissas declaradas

Limites:
- Até 1 análise por empresa por mês de referência (re-geração permitida em caso de re-import)
- Categorias DRE são as padrão Aicfo; customização só em planos superiores (Onda 2+)
- Lançamentos passados (mais de 24 meses) podem não ser considerados em benchmarking interno

Não garantimos:
- Recomendações são sugestões — decisão final é do CEO/sócio. Aicfo não assume responsabilidade por execução
- Conformidade fiscal/contábil — análise é gerencial, não substitui contabilidade oficial
- Detecção de fraude (módulo dedicado vem na Onda 7)
```

---

## 2. ICP do produto

| Campo | Valor |
|---|---|
| **Persona primária** | CEO/sócio/CFO de PME, que olha finanças mas não tem ferramenta dedicada |
| **Tamanho de empresa** | 5-150 funcionários, faturamento R$ 500k-R$ 10M/ano |
| **Vertical** | Agnóstico no piloto; personalização por segmento na Onda 1+ |
| **Pain principal** | Não tem visão do mês fechado sem esperar o contador (atraso 30-45 dias); decisões cegas |
| **Como descobre** | SEO ("DRE automático", "fechamento financeiro IA"), parcerias contábeis, indicação |

---

## 3. UX e fluxo

### 3.1. Onboarding

```
1. Cadastro (auth-tenant) → confirma email → cria workspace
2. Workspace setup: nome empresa, segmento, regime tributário
3. Hub vazio → CTA "Iniciar primeira análise"
4. Escolha de método de import (4 caminhos):
   a. Colar planilha (Ctrl+V de spreadsheet)
   b. Upload PDF do contador
   c. Upload Excel/CSV
   d. Lançamento manual (formulário)
5. Pipeline AIOS roda: ingest → classification → dre-narrative → action-plan
6. Hub atualiza: "Sua análise financeira" com lucro líquido + tags
7. Cliente clica em "Ver DRE completo" ou "Ver plano de ação"

Tempo total esperado: < 7 min do cadastro à primeira análise visível
```

### 3.2. Telas principais (referência aos mockups em `imagens_front/`)

| # | Tela | Função | Ação principal |
|---|---|---|---|
| 1 | **Hub de análise** | Home: lucro líquido current, tags ("3 gargalos / Plano pronto"), análises anteriores | "Ver DRE completo" / "Iniciar nova análise" |
| 2 | **DRE Facilitado** | DRE clássico (Receita Bruta → Lucro Líquido) com peso visual + 3 toggles (R$/%/vs. mês ant.) + section "Leitura da história" com 3 cards | Expandir linha do DRE / ler card |
| 3 | **Plano de Ação** | 3 horizontes (Curto/Médio/Longo) + projeção de impacto somada + cards executáveis com prazo/esforço/risco/impacto R$ | Marcar ação como "feita" (Onda 2) |

### 3.3. Inputs do cliente

- [x] Upload de arquivo (`.xlsx`, `.xls`, `.csv`, `.pdf`)
- [x] Colar planilha (HTML/text via clipboard)
- [x] Lançamento manual em formulário
- [ ] Integração via OAuth (Onda 4: ERPs, bancos)
- [ ] Webhook / API (Onda 4)

---

## 4. Pipeline de agentes

### 4.1. Etapas internas (não-visível ao cliente)

| Etapa | Agente / Módulo | Modelo | Responsabilidade | Output |
|---|---|---|---|---|
| 1 | `ingest` | (parser determinístico) | Detectar formato, extrair lançamentos, validar shape mínimo | `RawLedger[]` |
| 2 | `classification` | Gemini 2.5 Flash (LGPD) + GPT-4.1-mini (fallback ADR-010) | Classificar cada lançamento em categoria DRE + tags | `ClassifiedLedger[]` + confidence |
| 3 | `dre-narrative.aggregator` | (regra) | Agregar lançamentos em linhas DRE | `DRESnapshot` |
| 4 | `dre-narrative.narrator` | Gemini 2.5 Flash (LGPD) | Gerar 3 cards (gargalo / atenção / saudável) com causa + evidência numérica | `NarrativeCards[3]` |
| 5 | `action-plan.generator` | Gemini 2.5 Flash (LGPD) | Gerar plano 3-horizontes com impacto R$ estimado | `ActionPlan` |
| 6 | `financial-qa-review` (determinístico + LLM) | Gemini 2.5 Flash | Auditar narrativa+plano antes da publicação (number_mismatch, missing_doneWhen, contradiction) | `QaReview` |
| 7 | `qa-gate` | (regra) | Decide retry de narrative_synthesis / action_planning ou finalize | passa ou retry |

### 4.2. Telemetria (C6)

Toda chamada LLM em `src/monthly-analysis/graph/nodes/**` instrumentada via wrapper:

```ts
import { observe } from "@/observability/langfuse";

const trace = await observe({
  name: "narrative-synthesis",
  input: { tenantId, dreSnapshot },
  metadata: { sku: "monthly-analysis", outcomeType: "narrative_generated", monthRef: "2026-09" },
});
const response = await callLlm({ task: "narrative-synthesis", ... });
await trace.end({ output: response, costCents: response.costCents });
```

**Trace coverage gate**: 100% das chamadas LLM em produção devem ter trace_id. Sem trace → outcome não conta (`/acme:audit-monthly` flag).

---

## 5. Eval suite

- **Localização**: `evals/monthly-analysis/cases/` (a criar — etapa 6 do roadmap de promoção)
- **Casos mínimos**: 30 (gate Beta → GA por outcome principal — C4)
- **Cobertura**:
  - `dre_classified`: ≥10 casos (mix segmentos: agência, indústria leve, serviços, varejo, SaaS)
  - `narrative_generated`: ≥10 casos (mix de "saúde": empresa lucrativa, equilibrada, em ruptura, alta sazonalidade)
  - `action_plan_generated`: ≥10 casos (mix de "tipos de gargalo": custo, receita, mix, fluxo)
- **Adversarial**: ≥3 casos por outcome (input ambíguo, dados incompletos, edge cases)

**Estado atual** (2026-05-25):
- Suite E2E do SKU **ainda não criada** — bloqueia gate 4 de `/acme:promote`
- Suites por MÓDULO existem e passam: `dre-narrative` 93.8% via `assertion_shape`, `classification` ~97%, `action-plan` em iteração
- Estratégia de promoção: ver decisão pendente em `subscriptions/monthly-analysis/state.md`

---

## 6. Unit economics (resumo — detalhe em [`docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md`](../clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md))

| Métrica | Valor estimado (piloto) |
|---|---|
| Custo médio de inferência por análise | R$ 0,90 (Gemini Flash via Vertex AI) |
| Pricing (ARPU mensal) plano básico | R$ 99 |
| **Razão custo/preço** | **~0,9% ≤ 25% ✅** (status: `viable`) |
| Custo médio mensal por usuário ativo | R$ 0,90–1,80 (com export e re-geração) |
| CAC blended estimado (alvo) | R$ 200–500 |
| Payback estimado | 2-5 meses |

---

## 7. Lifecycle stage atual

| Stage atual | Critérios para promover |
|---|---|
| **mvp** | Pipeline E2E funcional + eval por módulo passando + spec migrada (✅) → Beta exige suite E2E + SHADOW run de 14 dias |

---

## 8. Configuração por tenant (C8)

Cliente novo = configuração, não branch:

| Campo | Tipo | Default | Exemplo |
|---|---|---|---|
| `industry_segment` | enum | "geral" | "agencia", "industria-leve", "servicos-b2b", "saas", "varejo" |
| `tax_regime` | enum | "simples" | "simples", "lucro-presumido", "lucro-real" |
| `tone_of_voice` | enum | "formal" | "formal", "informal" |
| `currency` | string | "BRL" | (futuro: USD para subsidiárias) |

Storage: `Tenant.productConfig.monthlyAnalysis.*` (Prisma JSON column).

**Lint anti-customização** (C8): nenhum `if (tenantId === '...')` ou `clients/{nome}/` em `src/skus`, `src/monthly-analysis`, `src/dre-narrative`.

---

## 9. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + Tailwind + TanStack Query em [`app/`](../../app/) (ADR-006) |
| Auth | JWT + Fastify (módulo `auth-tenant`) |
| Backend / API | Fastify 5 + LangGraph 1.2 |
| LLM | Google Vertex AI Gemini 2.5 Flash (LGPD; ADR-010) + OpenAI GPT-4.1-mini (fallback) |
| Observability | LangSmith (via LangChain) |
| Pagamentos | Stripe (módulo `billing`, Onda 0) |
| DB | PostgreSQL 16 + Prisma 6 |
| Filas | BullMQ 5 (processamento assíncrono de análise) |

> **C7 (Portability)**: SDKs de provedor isolados em `src/llm/adapters/`. Migração LGPD Anthropic→Google em 2026-05-22 (PR #53, #54, #55) exemplifica que a abstração funciona.

---

## 10. Riscos específicos do produto

| Risco | Mitigação |
|---|---|
| Acurácia de classificação <85% em segmentos não-vistos | Eval suite com mix de segmentos; refinement contínuo via casos reais (com consentimento) |
| Cliente importa lixo (lançamentos mal categorizados upstream) | Validação de shape mínimo + rejeitar com mensagem clara |
| Cliente "não acredita" no card de gargalo | Card sempre cita evidência numérica + permite click-through ao DRE detalhado |
| LLM gera plano de ação fora da realidade do cliente | Plano sempre baseado em dados do tenant; sem hallucination de fontes externas; `financial-qa-review` audita pre-publicação |
| Custo escala mal com volume | C3 monitorado mensalmente via `unit-economics-recalc` hook |

---

## 11. Métricas de sucesso

### Operacionais
- Outcomes/usuário ativo/mês: ≥1 análise (target 100% dos pagantes)
- Tempo médio até primeiro outcome (TTFO): <7 min do cadastro
- Taxa de sucesso de geração: ≥95% (5% restantes ficam em revisão manual)

### Comerciais
- Conversão trial → paid: ≥15%
- Churn mensal: ≤8%
- NPS: ≥50

### Técnicas (C3 / C6)
- Custo de inferência / ARPU: ≤25% (target ~1%)
- Latência p95 da geração de análise: <5 min
- Trace coverage: ≥99%

---

## 12. Histórico de versões

| Versão | Data | Mudança | Autor |
|---|---|---|---|
| 0.1.0 | 2026-05-08 | Spec inicial — discovery (em `src/skus/monthly-analysis/spec.md`) | Rafael Novaes |
| 0.2.0 | 2026-05-25 | Migração para Forge canonical path (`docs/specs/`); frontmatter Forge-compatible (c2_validation, outcome_clause_hash, outcome_categories, linked_*); pipeline 4.1 atualizado para Gemini Flash (LGPD) + financial-qa-review node | Rafael Novaes + Claude Sonnet 4.6 |
