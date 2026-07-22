---
module_key: "classification"
module_name: "Classification — Categorização DRE"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "#6, #7"
target_model_advisory: "gemini-2.0-flash"
c4_thresholds:
  agreement_rate: 0.95
  latency_p95_ms: 30000
  cost_per_outcome_brl: 0.05
  min_run_count: 30
  min_window_days: 14
outcomes:
  - key: "ledger_classified"
    description: "Lançamentos do ledger classificados com categoria DRE e confidence ≥0.7 em ≥95% dos casos"
  - key: "classification_confidence_low"
    description: "Lançamentos com confidence <0.7 sinalizados para revisão humana via PATCH /correct"
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# Classification — Categorização DRE

> Classifica cada lançamento do ledger em **1 de 23 categorias DRE** (taxonomia fechada) usando **Gemini 2.0 Flash** como modelo primário com fallback automático para **Claude Haiku 4.5**. Lançamentos com confidence <0.7 são marcados `needs_review` e podem ser corrigidos pelo cliente (em ASSISTED) ou pelo revisor interno (em SHADOW), alimentando o flywheel de dataset para fine-tune futuro.
>
> Decisão de modelo ratificada em [`ADR-002`](../adr/002-llm-model-strategy.md). `target_model_advisory: gemini-2.0-flash` declarado neste frontmatter é **sugestão** — decisão real vive em `src/llm/router.ts`, sob framework de benchmarking da ADR-002 §2.2.

---

## 1. Cláusula contratual de outcome (C2)

### 1.1. `ledger_classified`

> Os lançamentos do ledger são considerados **classificados** quando o agente atribui uma categoria DRE (1 de 23 da taxonomia fechada em `src/classification/taxonomy.ts`) **E** confidence score ≥0.7 a **≥95% dos lançamentos da análise**.

#### Exemplos POSITIVOS (cláusula cumprida)

1. Análise com 62 lançamentos: 60 classificados com confidence ≥0.7 (96.7%); 2 marcados `needs_review` com `predictedCategory` preenchido — **outcome cumprido**.
2. Análise com 200 lançamentos: 195 com confidence ≥0.85; 5 com confidence ≥0.7 — todos classificados, taxa 100% acima do limiar — **outcome cumprido**.
3. Análise com 20 lançamentos: 19 com confidence ≥0.7; 1 com confidence 0.65 marcado `needs_review` (95% atinge o piso exato) — **outcome cumprido**.

#### Exemplos NEGATIVOS (cláusula NÃO cumprida)

1. Análise com 62 lançamentos: 50 com confidence ≥0.7; 12 com confidence <0.7 — taxa 80.6% — **outcome NÃO cumprido**, requer triagem humana antes de encadear dre-narrative.
2. Análise com 30 lançamentos: 28 com confidence ≥0.7 mas 2 com `predictedCategory: "nao_classificado"` (categoria fallback, indica falha do batch JSON) — categorização incompleta para fins de DRE — **outcome NÃO cumprido**.
3. Análise com 100 lançamentos onde 10 entries têm `predictedCategory: null` (batch falhou e não atualizou) — **outcome NÃO cumprido**: contrato exige categoria atribuída.

### 1.2. `classification_confidence_low`

> Cada lançamento com confidence **<0.7** é considerado **para revisão humana** e disponibilizado ao cliente via `PATCH /classification/entries/:entryId/correct` quando a subscription está em modo **ASSISTED**. Em modo **SHADOW**, a correção é registrada apenas como telemetria/flywheel e não altera o estado entregue (C4).

#### Exemplos POSITIVOS

1. Lançamento "TED REC EMPRESA XYZ R$ 1.200,00" classificado como `receita_servicos` com confidence 0.62 → marcado `needs_review: true`, aparece em `GET /classification/:analysisId/review`.
2. Em ASSISTED, cliente corrige `receita_servicos` para `outras_receitas_operacionais` via PATCH — `confirmedCategory` atualizado, `correctionSource: "client"`, persistido como dataset.
3. Em SHADOW, Rafael corrige via PATCH com `source: "rafael"` — registrado para flywheel, mas saída ao cliente permanece intocada.

#### Exemplos NEGATIVOS

1. Lançamento com confidence 0.71 marcado `needs_review` (boundary errado) — **viola cláusula**: limiar é `<0.7`, não `≤0.7`.
2. PATCH em modo SHADOW que sobrescreve `confirmedCategory` no ledger entregue ao cliente — **viola C4**: SHADOW não pode mutar estado entregue.
3. PATCH com `source: "rafael"` aceito de usuário sem papel `internal` — **viola contrato**: cliente pode poluir flywheel marcando correção como interna.

---

## 2. Outcomes formais

| Outcome | Métrica | Threshold |
|---|---|---|
| `ledger_classified` | (entries com confidence ≥0.7) / (entries totais da análise) | ≥0.95 |
| `classification_confidence_low` | entries com confidence <0.7 disponibilizados em `GET /review` | 100% das entradas <0.7 acessíveis via API |

> **Nota**: o outcome `taxonomy_drift_detected` que constava no stub anterior foi **removido**. Não há implementação no backend (`src/classification/classifier.ts`) nem plano para Onda 1. Caso a detecção de padrões recorrentes sem categoria volte a ser priorizada, será reintroduzido em versão futura via spec separada, com sua própria eval suite e ADR justificativa.

---

## 3. C4 thresholds (SLA pré-contratado)

```yaml
c4_thresholds:
  agreement_rate: 0.95        # accuracy classificação vs revisor humano (ground truth)
  latency_p95_ms: 30000       # batch de 20 lançamentos, p95 entre prompt enviado e response parseado
  cost_per_outcome_brl: 0.05  # ~62 lançamentos por análise = ~R$0,05 (Gemini Flash 2.0)
  min_run_count: 30           # mínimo de execuções SHADOW antes de promover para ASSISTED
  min_window_days: 14         # janela mínima de observação SHADOW
```

Coerente com ADR-002 §2.2.3 (eixos do benchmark). Promoção via `/novais-digital:promote` exige `agreement_rate ≥0.95` em pelo menos 30 análises observadas em 14 dias consecutivos.

---

## 4. Endpoints expostos

Backend implementa em `src/classification/routes.ts`. Contrato consumido pelo frontend está em `docs/contracts/classification.openapi.yml` (Contract Agent).

### 4.1. `GET /classification/:analysisId/review`

Lista lançamentos com `needs_review: true` (confidence <0.7) ou já corrigidos.

**Auth**: tenant scope (header `x-tenant-id`).

**Response esperada (contrato OpenAPI)**:

```json
{
  "data": [
    {
      "entryId": "uuid",
      "description": "TED REC NOVAIS DIGITAL LTDA",
      "amount": 1200.00,
      "date": "2026-04-15",
      "predictedCategory": "receita_servicos",
      "confidence": 0.62,
      "confirmedCategory": null,
      "correctionSource": null,
      "needsReview": true
    }
  ],
  "meta": {
    "cursor": "opaque-cursor-string",
    "hasMore": false,
    "total": 1,
    "requestId": "uuid-v4"
  }
}
```

> **TODO (fix de contract drift identificado no review)**: a rota atual retorna `array` puro (`z.array(...)` em `routes.ts:20-32`). Precisa ser alinhada ao envelope `{ data, meta }` antes do merge final da Onda 1. Issue rastreada como `WARNING` → escalada para hard requirement de Onda 1 → ASSISTED.

**Errors**: devem seguir **RFC 7807** (`application/problem+json`), com campos `type / title / status / detail / instance / requestId`. Implementação atual retorna `{ message: "..." }` puro — **TODO de fix** antes do merge.

### 4.2. `PATCH /classification/entries/:entryId/correct`

Corrige categoria de um lançamento e alimenta flywheel.

**Body**:

```json
{
  "confirmedCategory": "outras_receitas_operacionais",
  "source": "client | rafael"
}
```

**Validação**:
- `confirmedCategory` ∈ `DRE_CATEGORIES` (taxonomia fechada — Zod enum)
- `source` ∈ `{"client", "rafael"}`. Se `req.auth.role !== "internal"`, força `source = "client"` (TODO — guard a adicionar)

**Enforcement C4** (✅ já implementado em commit `2e44531`):
- Middleware `requireMode("assisted")` aplicado: PATCH só efetiva mutação se subscription estiver em **ASSISTED** ou **AUTONOMOUS**
- Em **SHADOW**: requisição é aceita (200), registrada para telemetria/flywheel, mas **não altera `confirmedCategory`** no ledger entregue
- Comportamento documentado no test suite (`_tests_classification.md` cobre o caso)

**Response**:
- `200` — correção aplicada (modo permitido)
- `202` — em SHADOW, correção registrada como advisory; estado entregue intocado
- `403` — modo não permite mutação no tenant
- `404` — entryId não encontrado / pertence a outro tenant (problem+json)

---

## 5. Pipeline interno

```
┌──────────────────────────┐
│ Worker BullMQ (conc=3)   │  src/queue/workers.ts
│ job: "classify-analysis" │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ classifier.ts::classifyAnalysis(analysisId)  │
│  1. findMany(predictedCategory: null)        │
│  2. early return if entries.length === 0     │
│  3. split em batches de 20                   │
│  4. callLlm(prompt) por batch                │
│     - propaga traceId via job (commit a27ddd8)│
│     - L0 cacheado: buildSystemPrompt()       │
│     - L1+L2: industrySegment, taxRegime,     │
│       descrição, valor, data                 │
│  5. parse JSON → updateMany por entry        │
│     - confidence <0.7 → needs_review=true    │
│     - batch JSON inválido → predicted=       │
│       "nao_classificado" (fallback)          │
│  6. enqueueDreNarrative(analysisId)          │
└──────────────────────────────────────────────┘
```

Configuração:
- `BATCH_SIZE = 20` (hardcoded; SUGGESTION de ADR para tornar configurável)
- `LOW_CONFIDENCE_THRESHOLD = 0.7` (hardcoded; SUGGESTION de mover para `tenant-config`)
- `WORKER_CONCURRENCY = 3`

---

## 6. Configuração por tenant (C8)

Lida do `productConfig` em `tenant-config`:

| Campo | Uso | Default |
|---|---|---|
| `productConfig.monthlyAnalysis.industrySegment` | Inclui no user prompt L1 ("Esta empresa é do setor X") para melhorar few-shot | `"servicos_gerais"` |
| `productConfig.monthlyAnalysis.taxRegime` | Inclui no prompt L1 ("Regime tributário: Simples Nacional / Lucro Presumido / Lucro Real") — afeta como categorizar impostos | `"simples_nacional"` |

Nenhum outro hardcoded por tenant. Taxonomia DRE é **fonte única da verdade global** (`src/classification/taxonomy.ts` — 23 categorias + `nao_classificado` fallback).

---

## 7. Edge cases

| Caso | Comportamento esperado |
|---|---|
| **Descrição ambígua** ("TED 1200") | Modelo retorna confidence baixa (<0.7) → `needs_review: true`, `predictedCategory` é melhor palpite |
| **Valor zero ou negativo** | Classificação prossegue normalmente; sinal não infere categoria sozinho (estorno pode ser receita ou despesa) |
| **Data borderline** (último dia do mês, fuso) | Não afeta classificação (data não é input do modelo); affecta apenas roll-up DRE downstream |
| **Boundary do limiar 0.7** | `confidence == 0.7` → **não** é low (limiar é estrito `<0.7`). `0.6999` → low; `0.7000` → não-low |
| **Batch JSON inválido** | Apenas o batch falho é isolado: entries do batch recebem `predictedCategory: "nao_classificado"` com confidence 0; batches subsequentes prosseguem |
| **Análise vazia / sem entries não-classificadas** | Early return em `classifier.ts:31` antes do enqueue de dre-narrative (validado em test suite) |
| **Re-run de análise já classificada** | `findMany(predictedCategory: null)` retorna `[]` → early return; sem custo LLM, sem re-enqueue downstream |

---

## 8. Eval suite mínima

Versionada em `evals/classification/cases/`. Mínimo **30 casos** (C4 hard gate, ADR-002 §2.2.2).

**Distribuição obrigatória**:

| Tipo | Mínimo | Conteúdo |
|---|---|---|
| `real` | ≥40% (12 casos) | Lançamentos reais anonimizados de PMEs piloto |
| `synthetic` | ≤40% (≤12 casos) | Gerados a partir de gabaritos com variações |
| `edge` | ≥10% (3 casos) | Boundary 0.7, batch fail, descrição vazia, valor zero |
| `adversarial` | ≥10% (3 casos) | Descrições enganosas (ex: "pagamento RH" que é fornecedor), termos coloquiais BR ("rateio guela", "verba pra galera") |

**Métrica primária**: `agreement_rate` (categoria predita == categoria ground-truth). Threshold de promoção: ≥0.95.

**Métrica secundária**: confidence calibration — confidence ≥0.7 deve correlacionar com accuracy ≥0.9 nesses casos (modelo não pode ser confidente e errado).

Execução: `/novais-digital:eval --module classification --model gemini-2.0-flash`.

---

## 9. Unit economics (C3)

| Item | Valor |
|---|---|
| Modelo primário | Gemini 2.0 Flash |
| Input médio por batch (20 entries) | ~1.500 tokens (system L0 + L1 + 20 entries) |
| Output médio por batch | ~600 tokens (JSON estruturado) |
| Análise média | 62 lançamentos = ~4 batches |
| Custo por análise (estimado) | **R$ 0,02 – R$ 0,05** |
| Limite C3 (custo ≤ 25% do preço) | Plano R$ 200/mês → custo total pipeline ≤ R$ 50 → folga enorme |

Re-cálculo formal vinculado a `docs/onda-0/unit_economics.md`. Disparo automático de recalc sempre que `src/llm/router.ts` mudar (Gate 2 de `/novais-digital:promote`).

---

## 10. Telemetria (C6)

Toda chamada LLM é instrumentada via `callLlm` wrapper (`src/llm/index.ts`):

- **Trace name**: `classification`
- **Generation por batch**: 1 generation Langfuse por batch de 20 entries
- **TraceId propagado via job** (commit `a27ddd8`): job BullMQ carrega `traceId`, classifier passa para `callLlm`, vinculando trace ao `analysisId`
- **Metadata emitida**: `tenantId`, `analysisId`, `batchIndex`, `batchSize`, `model`, `promptVersion` (SUGGESTION pendente)
- **Cost**: calculado a partir de `usage.inputTokens` / `usage.outputTokens` × tabela de preços → `costBrl` na span
- **Fallback**: quando Gemini falha e router cai para Haiku, trace marca `model: "claude-haiku-4-5"` e `fallback_reason`

Sem trace, classificação **não conta como outcome auditável** (C6 hard gate).

---

## 11. Three-tier context (C5)

| Tier | Conteúdo | Origem |
|---|---|---|
| **L0** | Taxonomia DRE (23 categorias + definições + few-shot canônico) | `src/classification/taxonomy.ts` + `buildSystemPrompt()` (cacheável via prompt cache do provider) |
| **L1** | `industrySegment`, `taxRegime`, nome fantasia do tenant | `productConfig` (tenant-config) |
| **L2** | Entries do batch atual: descrição, valor, data | `LedgerEntry` da análise corrente |

System prompt é puro L0 (não vaza dados de tenant) → permite **prompt cache** entre análises de tenants diferentes. User prompt carrega L1+L2 (não cacheado entre tenants, como deve ser).

---

## 12. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Drift de taxonomia DRE** (categorias mudam por feedback de contador) | Média | Alto — invalida histórico classificado | Versionar `DRE_CATEGORIES` com `TAXONOMY_VERSION`; migração explícita por ADR; manter mapping backwards-compatible |
| **Viés do modelo em descrições BR coloquiais** ("rateio do bonde", "verba pra galera") | Alta | Médio — confidence baixa força triagem humana, custo de revisão sobe | Adversarial cases na eval suite (≥10%); fine-tune local em Fase 3 com dataset de correções acumuladas (flywheel) |
| **Quota gratuita Gemini esgota em produção** | Alta (já aconteceu em 2026-05-11) | Médio — fallback Haiku custa 1.5× mais | Conta paga Vertex AI obrigatória antes do primeiro cliente real (ADR-002 §1.3) |
| **Cliente em ASSISTED corrige em massa de forma errada** (poluindo flywheel) | Baixa | Alto — degrada dataset de fine-tune | Audit mensal (`/novais-digital:audit-monthly`) sample 5–10% das correções; outliers (>3 correções/dia/cliente) marcados para revisão |
| **JSON malformado do provider** | Baixa | Baixo — batch isolado falha, demais prosseguem | Fallback `nao_classificado` + log; entries afetadas sobem para `needs_review` automático |
| **PATCH /correct em SHADOW alterando estado entregue** | Eliminada (commit `2e44531`) | Alto se voltasse | `requireMode("assisted")` middleware; testes de integração cobrem os 3 modos |

---

## 13. Status de implementação (snapshot 2026-05-12)

| Item | Status |
|---|---|
| Worker BullMQ + classifier batches de 20 | ✅ `02ea90b` |
| Taxonomia 23 categorias + fallback `nao_classificado` | ✅ `02ea90b` |
| Prompt L0 cacheável + L1+L2 dinâmico | ✅ `02ea90b` |
| Fallback Gemini → Haiku via router | ✅ `02ea90b` |
| TraceId propagado via job | ✅ `a27ddd8` |
| C4 enforcement (`requireMode("assisted")` no PATCH) | ✅ `2e44531` |
| Flywheel: `correctedCategory` + `correctionSource` no LedgerEntry | ✅ `02ea90b` |
| Envelope `{data, meta}` em GET /review | ❌ TODO (drift de contrato — bloqueia merge Onda 1 → ASSISTED) |
| RFC 7807 errors | ❌ TODO (drift de contrato) |
| Guard `source: "rafael"` requer role internal | ❌ TODO (warning de segurança) |
| Verificação de posse de `analysisId` em GET /review | ❌ TODO (404/403 explícitos) |
| Eval suite ≥30 casos | ❌ TODO (Onda C dos fixes — pré-requisito ADR-002) |

---

## 14. Critério de pronto

- [x] Cláusula contratual de outcome formalizada (§1)
- [x] C4 thresholds declarados (§3 + frontmatter)
- [x] Endpoints documentados (§4)
- [x] Edge cases mapeados (§7)
- [x] Eval suite distribuição declarada (§8)
- [x] Unit economics estimada (§9)
- [x] Telemetria C6 confirmada (§10)
- [x] Three-tier context mapeado (§11)
- [x] Riscos catalogados (§12)
- [ ] Drift de contrato resolvido (envelope + RFC 7807) — bloqueia merge final
- [ ] Eval suite com 30 casos commitada em `evals/classification/cases/` — bloqueia promoção ASSISTED

Spec considerada `detailed` para fins de planejamento; promoção da subscription para ASSISTED bloqueada até os dois itens acima serem resolvidos.
