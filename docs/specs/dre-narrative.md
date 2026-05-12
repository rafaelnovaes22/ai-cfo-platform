---
module_key: "dre-narrative"
module_name: "DRE Narrative — Narrador da DRE"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "#8, #14, #15"
target_model_advisory: "gemini-2.5-flash"
outcomes:
  - "dre_aggregated"
  - "dre_narrated"
c4_thresholds:
  agreement_rate: 0.90
  latency_p95_ms: 15000
  cost_per_outcome_brl: 0.10
  min_run_count: 30
  min_window_days: 14
backend_commit: "cab4d85"
c4_enforcement_commit: "2e44531"
trace_propagation_commit: "a27ddd8"
related_adrs: ["002"]
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# DRE Narrative — Narrador da DRE

> Agrega lançamentos classificados em uma DRE Facilitada de 31 linhas (em centavos integer + margens decimais) e gera exatamente 3 cards de leitura — 1 `critical_gap`, 1 `attention`, 1 `healthy` — com título, corpo e evidência numérica. Módulo Tier B da Onda 1, encadeado após `classification` e antes de `action-plan`. Modelo primário **Gemini 2.5 Flash** com fallback Sonnet 4.6, conforme **[ADR-002](../adr/002-llm-model-strategy.md)**.

---

## 1. Cláusula contratual de outcome (C2)

Esta spec declara **dois** outcomes cobráveis e auditáveis. Um terceiro (`anomaly_flagged`) é explicitamente **deferido para v2** — ver §1.3.

### 1.1. `dre_aggregated`

**Cláusula literal**:

> Uma DRE é considerada **agregada** quando, a partir de lançamentos `confirmados` ou `predicted` do mês de referência do tenant, o agregador determinístico produz exatamente **31 linhas** em centavos `integer` (linhas monetárias) e em `decimal(5,4)` (margens), respeitando a precedência `confirmedCategory > predictedCategory` para classificação por categoria DRE, sem chamada a LLM.

**Critérios de aceite**:

- 31 chaves canônicas presentes (`receitaBruta`, `deducoes`, `receitaLiquida`, ... `naoClassificado`)
- Identidades contábeis verificadas:
  - `receitaLiquida == receitaBruta - deducoes`
  - `lucroBruto == receitaLiquida - cmv`
  - `ebitda == lucroBruto - totalDespesasOperacionais`
  - `lucroOperacional == ebitda - depreciacao - amortizacao`
  - `lucroLiquido == lucroOperacional - despesasFinanceiras + receitasFinanceiras - irCsll`
- Margens são `null` (não `NaN`, não `0`) quando `receitaBruta == 0` ou `receitaLiquida == 0`
- Latência p95 do agregador (determinístico, sem LLM): ≤ 500ms para até 5.000 lançamentos
- `dreJson` salvo como snapshot em `MonthlyAnalysis.dreJson` (JSONB)

#### Exemplos POSITIVOS

1. Tenant com 62 lançamentos confirmados; agregador retorna 31 chaves, margens calculadas, identidades batem, `naoClassificado == 0` → **agregado**.
2. Tenant com 120 lançamentos (80 `confirmed`, 40 `predicted`); agregador usa `confirmedCategory` quando presente e cai para `predictedCategory` no restante; 31 chaves, identidades batem → **agregado**.
3. Tenant com `receitaBruta == 0` (mês de PJ recém-aberta); margens vêm `null`; demais linhas em 0; identidades triviais batem → **agregado**.

#### Exemplos NEGATIVOS

1. Agregador retorna 30 chaves (esqueceu `outrasReceitasOperacionais`) → **não agregado**.
2. Agregador retorna margens em `NaN` quando `receitaLiquida == 0` (divisão por zero não tratada) → **não agregado**.
3. Agregador usa `predictedCategory` quando `confirmedCategory != null` (precedência invertida) → **não agregado**.

### 1.2. `dre_narrated`

**Cláusula literal**:

> Uma DRE é considerada **narrada** quando o agente entrega **exatamente 3 cards estruturados** (1 `critical_gap` + 1 `attention` + 1 `healthy`), cada card com `title` (≤ 80 chars), `body` (≤ 400 chars) e `evidence` array com ao menos 1 métrica derivada do DRE agregado (`label`, `value`, `unit`), gerados pelo LLM declarado em `target_model_advisory` em latência p95 ≤ 15.000ms e custo por outcome ≤ R$ 0,10.

**Critérios de aceite**:

- Resposta do LLM parseia em JSON válido (sem fence)
- Schema Zod aprovado: `{ cards: NarrativeCard[3] }` com tipos exatamente `["critical_gap", "attention", "healthy"]`
- `title.length ≤ 80`, `body.length ≤ 400`, `evidence.length ≥ 1`
- Toda métrica em `evidence` é derivável do `dreJson` (não inventada pelo LLM)
- Trace Langfuse com `name="dre-narrative"` + generation; `langfuseTraceId` persistido em `MonthlyAnalysis` (corrigido no commit `2e44531`)
- `narrativeJson` salvo como snapshot em `MonthlyAnalysis.narrativeJson` (JSONB)
- 3 `NarrativeCard` persistidos via `deleteMany` + `createMany` em transação (idempotente em re-geração)

#### Exemplos POSITIVOS

1. DRE com pessoal+prolabore == 45% da receita líquida; LLM produz card `attention` com `title="Custo de pessoal pressiona o resultado"`, body explicando, `evidence=[{label:"Pessoal/RL", value:0.45, unit:"ratio"}]` → **narrado**.
2. DRE com margem líquida == 18%, sem alertas; LLM produz `healthy` celebrando, `attention` em despesa secundária, `critical_gap` em CMV elevado → **narrado** (3 cards mesmo se nada crítico, conforme regra fixa de saída).
3. Re-geração após cliente reclassificar transação: deleta 3 cards anteriores em transação, cria 3 novos com `langfuseTraceId` novo → **narrado** (idempotente).

#### Exemplos NEGATIVOS

1. LLM retorna 2 cards (faltou `healthy`) → **não narrado**; pipeline deve falhar com erro estruturado.
2. LLM cita métrica `"CAC R$ 1.200"` em `evidence` mas DRE não tem dado de CAC → **não narrado** (alucinação; rejeitar no validator).
3. Body de 612 chars → **não narrado** (viola limite contratual; truncar não é aceito — re-prompt).

### 1.3. `anomaly_flagged` — DEFERIDO para v2

**Não é outcome de Onda 1.** Declarado no roadmap como item futuro, com a seguinte justificativa:

> Detectar anomalia mês-a-mês (ex: variação > 30% vs. mês anterior) exige **baseline histórico de pelo menos 3 meses do tenant** para que o threshold deixe de ser arbitrário e vire estatisticamente significativo. Onda 1 onboardará tenants sem histórico no Aicfo; o primeiro mês do tenant nunca terá comparativo, e o segundo e terceiro terão amostra insuficiente. Implementar `anomaly_flagged` antes desse acúmulo geraria falsos positivos sistemáticos e degradaria a confiança nos cards. Será movido para Onda 2 (módulo `kpis`/`alerts`), quando combinado com baseline histórico + tendência cashflow.

Esta decisão substitui o item `anomaly_flagged` listado na versão `stub` anterior desta spec.

---

## 2. Endpoints expostos pelo backend

| Método | Rota | Auth | Modos permitidos | Descrição |
|---|---|---|---|---|
| `GET` | `/analysis/:id/dre` | `requireAuth` | qualquer | Retorna `dreJson` (31 linhas) + status da análise |
| `GET` | `/analysis/:id/narrative` | `requireAuth` | **bloqueado em SHADOW** | Retorna os 3 cards persistidos. Em `mode == "shadow"`, retorna **404** (correção do commit `2e44531`) |
| `PATCH` | `/analysis/:id/narrative/:cardId/feedback` | `requireAuth` + `requireMode("assisted")` | **apenas ASSISTED** | Persiste `feedback ∈ {approved, rejected, edited}` + `comment ≤ 500 chars`. Bloqueado em SHADOW e AUTONOMOUS (correção do commit `2e44531`) |

**Multi-tenancy hard isolation (C8)**: todo handler usa `req.auth.tenantId`; rejeita `tenantId` em query/body. `analysisId` deve pertencer ao `tenantId` autenticado ou retorna 404 (não 403, para não vazar existência).

**Validação Zod**: `comment` rejeitado se `> 500` chars; `feedback` rejeitado se fora do enum.

---

## 3. Pipeline e mutações de estado

```
ingest concluído
   └─> classification (worker)
         └─> dre-narrative (worker, concorrência 2)
               ├─ aggregator.aggregate(tenantId, period)   [determinístico, sem LLM]
               │     └─ MonthlyAnalysis.dreJson := snapshot 31 linhas
               ├─ narrator.narrate(dreJson, tenantContext) [LLM Gemini Flash]
               │     ├─ system prompt L0 (cacheável)
               │     ├─ user prompt L1+L2 (tenant + outcome)
               │     ├─ Langfuse generation span (C6)
               │     └─ Zod validate → 3 cards
               ├─ persiste NarrativeCard[3] (deleteMany + createMany em tx)
               ├─ MonthlyAnalysis.narrativeJson := snapshot
               ├─ MonthlyAnalysis.langfuseTraceId := llmResponse.traceId  (commit 2e44531)
               ├─ MonthlyAnalysis.costCents += llmResponse.costCents      (acumulado p/ C3)
               └─> enqueueActionPlan(analysisId)
```

### 3.1. Estados de `MonthlyAnalysis`

| Status | Significado | C4 |
|---|---|---|
| `processing` | worker rodando | cards não existem ainda |
| `ready` | cards gerados, ainda não entregues ao cliente | em SHADOW, fica em `ready` até revisão humana |
| `delivered` | entregue ao cliente (visível no hub) | ASSISTED/AUTONOMOUS após `POST /deliver` |
| `approved` | cliente "fechou" o mês | imutável; re-geração proibida |
| `failed` | erro no pipeline | retry manual via reprocessamento |

### 3.2. C4 enforcement (commit `2e44531`)

- `GET /narrative` retorna **404** quando `analysis.mode === "shadow"` — em SHADOW a análise existe mas não é entregue ao cliente; reviewer humano (Rafael) acessa por canal interno
- `PATCH /feedback` requer `requireMode("assisted")` — em SHADOW (sem entrega) e AUTONOMOUS (cliente apenas audita amostra) o feedback per-card não tem semântica; rota retorna 403
- Promoção SHADOW → ASSISTED → AUTONOMOUS controlada por `/acme:promote` (não por flag manual)

### 3.3. C6 fix (commit `2e44531`)

Antes: `MonthlyAnalysis.langfuseTraceId = llmResponse.costCents.toString()` (bug — gravava custo no campo errado).

Depois: `LlmResponse` foi estendido com `traceId: string` plumado do adapter Langfuse; `narrator` grava `langfuseTraceId = llmResponse.traceId`. Auditoria DeepAgent volta a poder correlacionar análise → trace.

### 3.4. Trace propagation (commit `a27ddd8`)

`traceId` da chamada `ingest → classification → dre-narrative → action-plan` é propagado via job BullMQ (`job.data.parentTraceId`), permitindo reconstruir a sessão completa no Langfuse para auditoria mensal.

---

## 4. Estrutura `DreLines` (31 chaves canônicas)

Estrutura monetária em **centavos `integer`**; margens em **`decimal(5,4)`** ou `null`.

```
receitaBruta, deducoes, receitaLiquida,
cmv, lucroBruto,
despesasComerciais, despesasAdministrativas, despesasPessoal, prolabore, despesasOcupacao,
despesasTecnologia, despesasViagens, despesasMarketing, outrasDespesasOperacionais,
totalDespesasOperacionais, ebitda,
depreciacao, amortizacao, lucroOperacional,
receitasFinanceiras, despesasFinanceiras, resultadoFinanceiro,
lucroAntesIR, irCsll, lucroLiquido,
margemBruta, margemOperacional, margemEbitda, margemLiquida,
outrasReceitasOperacionais, naoClassificado
```

**Regra de precedência**: para cada `Transaction`, usar `confirmedCategory` se presente, senão `predictedCategory`. Lançamentos sem nenhum dos dois caem em `naoClassificado` (não bloqueia agregação).

**Política de divisão por zero**: margens vêm `null` (não `NaN`, não `0`) quando o denominador é `0`. Frontend renderiza como `"—"`.

---

## 5. Edge cases declarados

| Caso | Comportamento canônico |
|---|---|
| `naoClassificado > 0` | Agregação completa; frontend exibe banner "X lançamentos não classificados" não-bloqueante. NÃO impede entrega ao cliente |
| Margens negativas | Formatação BR (`-15,3%`); cor visual de alerta; narrador trata como `critical_gap` candidato |
| Divisão por zero (`receitaBruta == 0`) | Margens = `null`, exibidas como `"—"`; narrador adapta cards (foco em despesas, não em margem) |
| Mês fechado (`status == approved`) | Re-geração **proibida** via 409 Conflict; cliente deve "reabrir o mês" (módulo `hub`) |
| Mês aberto (`status ∈ {ready, delivered}`) | Re-geração permitida; `deleteMany(cards) + createMany(cards)` em transação Prisma única |
| LLM retorna JSON inválido | Erro estruturado, retry **1×** com prompt reforçado ("retorne JSON puro, sem fence"); 2ª falha eleva ao fallback Sonnet 4.6 |
| LLM retorna ≠ 3 cards ou tipos errados | Erro estruturado; mesmo flow de retry+fallback acima |
| Cliente reclassifica transação após `dre_narrated` | Detector em `classification` re-enfileira `dre-narrative`; novo trace; cards anteriores substituídos atomically |

---

## 6. Configuração por tenant (C8)

Lida apenas no nível L1+L2, nunca hardcoded:

| Campo | Tipo | Default | Origem |
|---|---|---|---|
| `productConfig.monthlyAnalysis.toneOfVoice` | `"formal" \| "informal"` | `"formal"` | `Tenant.productConfig` JSONB |
| `productConfig.monthlyAnalysis.customInstructions` | `string ≤ 500 chars` | `null` | `Tenant.productConfig` JSONB |
| `tenant.industrySegment` | `string` | required | `Tenant` row (L1) |
| `tenant.taxRegime` | `"simples" \| "lucroPresumido" \| "lucroReal"` | required | `Tenant` row (L1) |

**Regra PII**: `tenantId`, `cnpj`, `razaoSocial` **nunca** vão no `userPrompt` em texto livre — apenas em `meta` da chamada LLM (que não vai para o provider). Validar com guard no `narrator`.

**Regra prompt L0 (C5)**: system prompt é cacheável e contém apenas DNA Aicfo + glossário DRE + regras de negócio gerais. Tenant data entra exclusivamente no user prompt (L1+L2).

---

## 7. Regras de negócio canônicas

Movidas do system prompt para spec auditável (atende WARNINGs do review):

| Regra | Threshold | Tipo de card sugerido |
|---|---|---|
| Margem líquida < 5% | crítico | `critical_gap` ou `attention` |
| Pessoal + prolabore > 40% receita líquida | alerta | `attention` |
| CMV > 60% receita bruta | alerta | `attention` |
| Margem EBITDA > 15% e Lucro Líquido > 0 | saudável | `healthy` |
| Crescimento receita MoM > 10% (quando houver baseline) | saudável | `healthy` — Onda 2+ |
| Despesas financeiras > 15% lucro operacional | alerta | `attention` |

Regras são **sugestões ao LLM**, não asserts hard-coded — o LLM tem autonomia para combinar evidências. Eval suite (§9) valida que regras são respeitadas em casos canônicos.

---

## 8. Telemetria (C6)

Toda chamada LLM em `src/dre-narrative/narrator.ts` está instrumentada:

```ts
const span = trace.start({
  name: "dre-narrative",
  input: { tenantId, analysisId, period },
  metadata: { sku: "monthly-analysis", outcomeType: "dre_narrated", mode },
});
const llmResponse = await callLlm({ task: "dre-narrative", ... });
span.end({ output: llmResponse.parsed, costBrl: llmResponse.costBrl, traceId: llmResponse.traceId });
```

- `parentTraceId` herdado via job BullMQ (commit `a27ddd8`)
- `costCents` acumulado em `MonthlyAnalysis.costCents` (necessário para auditar C3 mensalmente)
- `modelVersion` registrada no `narrativeJson` para rollback / drift audit

---

## 9. Eval suite mínima

Localização: `evals/dre-narrative/cases/*.json` — **≥ 30 casos** distribuídos:

| Fonte | Mínimo | Conteúdo |
|---|---|---|
| `real` | ≥ 40% (≥12) | DREs anonimizadas de PMEs piloto |
| `synthetic` | ≤ 40% (≤12) | Gerados com receita/despesa controlada para cada threshold da §7 |
| `edge` | ≥ 10% (≥3) | `receitaBruta=0`, `naoClassificado>0`, margens negativas extremas |
| `adversarial` | ≥ 10% (≥3) | Tenta induzir alucinação (descrições com números falsos), PII leak, JSON malformado |

**Ground-truth por caso**:
- `dre_aggregated`: 31 chaves esperadas (exact_match)
- `dre_narrated`: rubrica `llm_as_judge` (claude-3-5-sonnet-judge) avaliando 3 eixos:
  1. **Clareza** (0-5) — leitura fluente para leigo financeiro
  2. **Acionabilidade** (0-5) — sugere direção ou aponta causa
  3. **Factualidade** (0-5) — toda métrica em `evidence` é derivável do `dreJson`

**Limites mínimos para promoção SHADOW → ASSISTED**:
- pass_rate `dre_aggregated` ≥ 100% (determinístico)
- pass_rate `dre_narrated` ≥ 0.85 (judge médio ≥ 4.0/5)
- Variância em 5 reruns (temperature=0): < 5% diff de strings críticos

Execução via `/acme:eval --module dre-narrative --model gemini-2.5-flash`.

---

## 10. Unit economics (C3)

Custo por outcome alvo: **≤ R$ 0,10** por `dre_narrated` (Gemini 2.5 Flash, 2026-05).

Composição típica (62 lançamentos, mês fechado):
- Input tokens: ~2.500 (system L0 cacheado + dreJson + tenant context)
- Output tokens: ~700 (3 cards estruturados)
- Custo unitário Gemini Flash @ 2026-05: ~R$ 0,015 (entrada) + ~R$ 0,008 (saída) = **R$ 0,023/outcome**

Folga vs C3 (custo ≤ 25% preço): com preço alvo R$ 200/mês e 1 análise/mês, custo de inferência total do SKU `monthly-analysis` (classification + dre-narrative + action-plan) deve ficar < R$ 50/mês — `dre-narrative` consome ~5% desse budget.

Trigger de re-avaliação: ver ADR-002 §2.2.1.

---

## 11. Riscos específicos

| Risco | Mitigação atual | Mitigação futura |
|---|---|---|
| **Alucinação em narrativa** | Validator rejeita `evidence` com métricas não-derivadas do `dreJson` | Schema versionado de `evidence` + tool calling para forçar derivação |
| **Tom of voice drift** | Eval suite com 5 reruns valida variância < 5%; `toneOfVoice` em prompt L1 | Snapshot hash do prompt L0 (suggestion do review) |
| **PII leakage** | `tenantId/cnpj/razaoSocial` apenas em `meta`, nunca em `userPrompt`; guard no narrator | Migração Vertex AI (LGPD) — ADR futura |
| **Quota Gemini esgotada** | Fallback automático Sonnet 4.6 via `src/llm/router.ts` | Multi-provider (GPT-4o-mini como 2º fallback) |
| **JSON inválido / fence Markdown** | Stripping `application/json` mode + retry 1× + fallback | Tool calling estruturado (Gemini structured output) |
| **Re-geração concorrente** | `deleteMany + createMany` em transação Prisma | Lock pessimista por `analysisId` se concorrência crescer |
| **Drift de regras de negócio em prompt** | Regras §7 espelhadas em eval cases | Mover regras para `business_rules` config + injetar no prompt |

---

## 12. Roadmap pós-Onda 1

- `anomaly_flagged` — Onda 2 (após 3 meses de baseline histórico por tenant)
- Comparativo MoM/YoY em cards — Onda 2 (integrado a `kpis`)
- Tom of voice extensível (`direto`, `educacional`) — Onda 3
- Tool calling estruturado (output JSON garantido pelo provider) — Onda 2
- Vertex AI migração (LGPD) — antes do 1º cliente real assinar
- Snapshot hash do prompt L0 versionado — Onda 2 (governança)

---

## 13. Histórico

| Data | Mudança | Autor |
|---|---|---|
| 2026-05-08 | Stub inicial | Spec Agent |
| 2026-05-11 | Backend implementado (commit `cab4d85`) | Backend Agent |
| 2026-05-12 | Review consolidado — 8 BLOCKERs (`_review_dre-narrative.md`) | Review Agent |
| 2026-05-12 | C4/C6 fixes (commit `2e44531`); trace propagation (commit `a27ddd8`) | Backend Agent |
| 2026-05-12 | Promoção stub → detailed; ADR-002 ratificada; `anomaly_flagged` deferido para v2; c4_thresholds + target_model_advisory declarados | Spec Agent |
