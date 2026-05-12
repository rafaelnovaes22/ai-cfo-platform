---
module_key: "action-plan"
module_name: "Action Plan — Plano de Ação 3-horizontes"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "#13, #45, #46"
target_model_advisory: "gemini-2.5-flash"
target_model_advisory_note: >
  Decisão histórica que motivou ADR-002 (Estratégia de modelo LLM por task).
  A spec original de Onda 0 (`docs/onda-0/...`) e ADR-001 mencionavam
  Sonnet 4.6 / Opus 4.7 como stack padrão; a divergência foi detectada pelo
  Review Agent de 2026-05-12 (BLOCKER: "divergência de modelo afeta C3 sem ADR")
  e formalizada na ADR-002 com framework de benchmarking obrigatório
  (5 eixos: qualidade, latência, custo, determinismo, compliance).
  Esta entrada é apenas advisory — a decisão real de modelo vive em
  `src/llm/router.ts` e só muda via processo §2.2.4 da ADR-002.
c4_thresholds:
  agreement_rate: 0.85
  latency_p95_ms: 25000
  cost_per_outcome_brl: 0.12
  min_run_count: 30
  min_window_days: 14
outcomes:
  - id: "plan_generated"
    cobravel: true
    descricao: >
      Plano de ação é considerado gerado quando o agente entrega exatamente 5
      itens de horizonte 'short', 1+ 'medium' e 1+ 'long', cada item com title
      (≤120 chars), description (≤500 chars), effortLevel ∈ {low,medium,high},
      riskLevel ∈ {low,medium,high}, impactCents (integer ≥0) e doneWhen
      (string não-vazia descrevendo critério executável e mensurável).
  - id: "plan_approved"
    cobravel: true
    descricao: >
      Plano é aprovado quando o cliente em ASSISTED chama POST
      /analysis/:id/approve E status da análise transiciona para 'approved'
      E approvedAt é persistido com timestamp do servidor.
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# Action Plan — Plano de Ação 3-horizontes

> Gera plano de ação com 3 horizontes (curto: até 3m / médio: 3–6m / longo: >12m).
> Para cada ação: título, descrição, esforço, risco, impacto R$ estimado, prazo em dias e `doneWhen`.
> Modelo primário **Gemini 2.5 Flash** (advisory; decisão real em `src/llm/router.ts` — ver ADR-002).
> Fallback automático: Claude Sonnet 4.6 quando adapter Google falha.

---

## 1. Cláusula contratual de outcome (C2)

### 1.1. `plan_generated` (cobrável — entrega operacional)

> "Plano de ação é considerado **gerado** quando o agente entrega exatamente **5 itens de horizonte 'short'**, **1 ou mais 'medium'** e **1 ou mais 'long'**, e cada item contém: `title`, `description`, `effortLevel ∈ {low,medium,high}`, `riskLevel ∈ {low,medium,high}`, `impactCents` (inteiro ≥0) e `doneWhen` (critério executável e mensurável, string não-vazia). Itens fora do schema invalidam o outcome. Retry único é tolerado; após retry esgotado sem mínimos atendidos, o plano **não** pode ser persistido."

#### Exemplos POSITIVOS (plano gerado, cobrável)

1. **Plano completo com 5 short + 2 medium + 1 long**, todos com `doneWhen` mensurável (ex: "reduzir custo de telefonia em R$1.200/mês até 30/06"). Schema válido + retry não acionado → `plan_generated = true`.
2. **Plano com 5 short + 1 medium + 3 long**, retry acionado na primeira chamada (LLM retornou apenas 4 short), segunda chamada corrigiu para 5 short. Resultado final atende mínimos → `plan_generated = true`.
3. **Plano com 5 short + 1 medium + 1 long**, `impactCents = 0` em 2 itens short (ações de governança sem impacto financeiro direto, ex: "implantar reunião semanal de fechamento"). Schema válido (≥0 permite zero); `doneWhen` mensurável → `plan_generated = true`.

#### Exemplos NEGATIVOS (plano **não** gerado, não cobrável)

1. **Plano com 4 short + 1 medium + 1 long** após retry esgotado. Mínimo de 5 short violado → erro lançado, persistência bloqueada, outcome **não** computado.
2. **Plano com 5 short + 2 medium + 1 long**, mas 1 item com `doneWhen = null` (gap atual do schema — `doneWhen` é nullable). Mesmo se o schema atual aceitar, o outcome contratual **não** é satisfeito; tornar `doneWhen` obrigatório é TODO Onda C (warning do review).
3. **Plano com 5 short + 0 medium + 2 long**. Falta `medium` (mínimo 1) → erro lançado, persistência bloqueada, outcome **não** computado.

### 1.2. `plan_approved` (cobrável — confirmação de valor pelo cliente)

> "Plano é considerado **aprovado** quando o cliente em modo `ASSISTED` chama `POST /analysis/:id/approve` **E** o status da análise transiciona de `ready` para `approved` **E** `approvedAt` é persistido com timestamp do servidor. Chamadas em modo `SHADOW` ou `AUTONOMOUS` retornam 403/409. Chamadas idempotentes (já aprovado) retornam 200 com o `approvedAt` original preservado."

#### Exemplos POSITIVOS

1. Cliente em ASSISTED revisa o plano no hub, ajusta feedback em 2 itens via PATCH, chama POST /approve → status `approved`, `approvedAt = 2026-05-12T14:33:21Z` → `plan_approved = true`.
2. Cliente em ASSISTED chama POST /approve sem ter editado nada → status `approved`, `approvedAt` persistido → `plan_approved = true` (revisão sem edição é válida).
3. Cliente em ASSISTED chama POST /approve duas vezes em sequência (double-click no botão); segunda chamada retorna 200 com o mesmo `approvedAt` original → idempotência respeitada, **um** outcome `plan_approved` computado.

#### Exemplos NEGATIVOS

1. Cliente em SHADOW (backend não entregou a análise) chama POST /approve → 403 Forbidden (`requireMode("assisted")` rejeita) → `plan_approved = false`.
2. Cliente em AUTONOMOUS chama POST /approve → 403 Forbidden (em AUTONOMOUS o backend já marcou `delivered` automaticamente e não exige aprovação explícita) → `plan_approved = false`.
3. Análise inexistente / pertencente a outro tenant → 404 Not Found após validação `tenantId` do JWT → `plan_approved = false`.

---

## 2. C4 thresholds (SLA pré-contratada)

```yaml
c4_thresholds:
  agreement_rate: 0.85       # ações marcadas "executáveis" por Rafael revisor em SHADOW
  latency_p95_ms: 25000      # p95 ponta-a-ponta da geração (worker → LLM → persist)
  cost_per_outcome_brl: 0.12 # custo médio Gemini Flash por plano gerado
  min_run_count: 30          # mínimo de planos em SHADOW antes de promover
  min_window_days: 14        # janela mínima de observação SHADOW
```

Thresholds bloqueiam promoção SHADOW → ASSISTED se não atingidos. `cost_per_outcome_brl = 0.12` confirma C3 com folga (≤25% do preço — ver §6).

---

## 3. Outcomes formais

| Outcome | Definição operacional | Cobrável | Modo permitido |
|---|---|---|---|
| `plan_generated` | LLM gera 5 short + ≥1 medium + ≥1 long, todos válidos pelo schema Zod | sim | todos (gerado em background pelo worker) |
| `plan_approved` | cliente em ASSISTED chama POST /approve com sucesso | sim | apenas ASSISTED |

---

## 4. Endpoints

### 4.1. `GET /analysis/:id/action-plan`

- **Auth**: JWT obrigatório; `tenantId` lido do claim (nunca de header)
- **Modo**: livre (cliente vê plano em ASSISTED; em SHADOW o backend **pode** redactar resposta — TODO Onda C)
- **Resposta**: itens agrupados por horizonte + `summary` (totais por horizonte, impacto total)
- **Schema**: `ActionItemSchema` (ver §5)

### 4.2. `PATCH /analysis/:id/action-plan/:itemId/feedback`

- **Auth**: JWT + `requireMode("assisted")` — **bloqueia em SHADOW e AUTONOMOUS** (BLOCKER do review, fix em commit `2e44531`)
- **Body**: `{ status?: "accepted"|"rejected"|"deferred", note?: string }`
- **Efeito**: persiste feedback do cliente em `ActionItem.feedback` (JSON); não regenera o plano

### 4.3. `POST /analysis/:id/approve`

- **Auth**: JWT + `requireMode("assisted")` — **bloqueia em SHADOW e AUTONOMOUS** (BLOCKER do review, fix em commit `2e44531`)
- **Idempotência**: se já aprovado, retorna 200 com `approvedAt` original (não sobrescreve)
- **Efeito**: `Analysis.status = "approved"`, `Analysis.approvedAt = now()`; dispara evento downstream (export, etc.)

---

## 5. Schema persistido (Prisma + Zod)

```ts
ActionItem {
  id: string (cuid)
  analysisId: string (FK Analysis)
  horizon: "short" | "medium" | "long"  // z.enum — ver gap drift §7
  title: string (≤120)
  description: string (≤500)
  effortLevel: "low" | "medium" | "high"
  riskLevel: "low" | "medium" | "high"
  impactCents: int ≥0
  deadlineDays: int ≥0
  doneWhen: string  // hoje nullable — TODO Onda C: obrigatório
  feedback: Json?   // { status, note, updatedAt }
  createdAt: timestamptz
}
```

---

## 6. C4 enforcement (modos)

Implementado no commit **`2e44531`** (Onda A fix):

| Endpoint | SHADOW | ASSISTED | AUTONOMOUS |
|---|---|---|---|
| GET /action-plan | permitido¹ | permitido | permitido |
| PATCH feedback | **403** | permitido | **403** |
| POST /approve | **403** | permitido | **403**² |

¹ Em SHADOW, o cliente teoricamente não deveria ver o plano (análise não entregue). Hoje a rota retorna 200 — TODO Onda C: redact ou bloquear.
² Em AUTONOMOUS, o status já transiciona para `delivered` automaticamente no worker; aprovação manual não se aplica.

---

## 7. Edge cases conhecidos

| Caso | Comportamento atual | Status |
|---|---|---|
| POST /approve idempotente (análise já approved) | retorna 200 com `approvedAt` original preservado | OK |
| Double-submit POST /approve (concorrência real) | sem `SELECT ... FOR UPDATE` no UPDATE; em mock passa, em PG real pode haver race | WARNING — TODO Onda C: adicionar lock SQL ou cláusula `WHERE status != 'approved'` |
| `doneWhen` nullable no schema | LLM pode persistir item sem doneWhen e schema aceita | WARNING — TODO Onda C: tornar obrigatório no Zod e no Prisma |
| Retry de LLM esgotado sem `long` | schema `min(5) short` passa, mas mínimo de 1 long não é validado pós-retry → plano persiste violando `plan_generated` | BLOCKER — TODO Onda C: adicionar validação `min(1)` por horizonte no Zod |
| `horizon: z.string()` em `routes.ts` vs `z.enum(["short","medium","long"])` em `generator.ts` | drift inter-camadas; valor inválido pode escapar pela camada HTTP | BLOCKER — TODO Onda C: alinhar para `z.enum` nas duas camadas |
| Análise inexistente / cross-tenant | 404 após validação de `tenantId` do JWT | OK |

---

## 8. Configuração por tenant (C8)

Toggles consumidos pelo `generator.ts` via `TenantContext`:

| Campo | Origem | Efeito |
|---|---|---|
| `productConfig.monthlyAnalysis.toneOfVoice` | `Tenant.productConfig.json` | afeta tom das ações ("formal" vs "direto") |
| `tenant.industrySegment` | `Tenant.industrySegment` | afeta tipo de ação sugerida (varejo prioriza estoque/markup; serviços prioriza horas faturáveis/CAC) |

**TODO Onda C** (warning do review): ampliar para incluir `regimeTributario`, `porte`, `regiao` — hoje só `toneOfVoice` é testado.

Hardcode por tenant em `prompts.ts` ou `generator.ts` viola C8 e bloqueia merge (hook `c8-guard`).

---

## 9. Eval suite mínima

Localização: `evals/action-plan/cases/`

**Quantidade mínima**: ≥30 casos (C4 hard gate).

**Mix de fontes**:
- real ≥40% (≥12 casos): exports de DREs reais de PMEs piloto
- synthetic ≤40% (≤12 casos): gerados sinteticamente cobrindo segmentos/portes
- edge ≥10% (≥3 casos): retry, doneWhen vazio, horizon inválido, idempotência
- adversarial ≥10% (≥3 casos): prompts maliciosos, prompt injection, valores extremos

**Dimensões de avaliação**:

| Dimensão | Método | Pass criteria |
|---|---|---|
| Schema válido | binary (Zod parse) | 100% dos itens passam no `ActionItemSchema` |
| Acionabilidade | LLM-as-judge (Sonnet 4.6 como juiz) | ≥0.85 dos itens marcados "executável" (doneWhen mensurável, efeito claro) |
| Impacto plausível | revisão humana amostral (Rafael, 20% dos casos) | ≥0.80 dos `impactCents` marcados "plausível" (derivado de fórmula, não inventado) |

Execução: `/acme:eval --module action-plan --model gemini-2.5-flash`.

---

## 10. Telemetria (C6)

Toda chamada LLM em `src/action-plan/generator.ts` deve estar instrumentada com Langfuse:

```ts
const span = trace.start({
  name: "action-plan",
  input: { analysisId, tenantId, dreSummary, cards },
  metadata: { module: "action-plan", sku: "monthly-analysis", outcomeType: "plan_generated" },
});
const response = await llm.call({ model: "gemini-2.5-flash", ... });
span.end({
  output: { itemsGenerated, retryCount },
  costBrl: calculateCost(response.usage, "gemini-2.5-flash"),
});
```

`traceId` deve ser propagado via job BullMQ para correlação end-to-end (ingest → classification → dre-narrative → action-plan).

Sem trace, **não conta como outcome auditável** (C6).

---

## 11. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| **Alucinação de `impactCents`** — LLM tende a inventar valores monetários sem base no DRE | alta | pedir derivação de fórmula explícita no `doneWhen` (ex: "reduzir telefonia em R$1.200/mês = 12 linhas × R$100"); revisão humana amostral em SHADOW |
| **Itens repetidos entre horizontes** — mesma ação aparece em short e medium com wording diferente | média | system prompt explicitamente proíbe duplicação semântica; eval adversarial cobre o caso |
| **Tom genérico** — ações sem aderência ao `industrySegment` do tenant | média | `industrySegment` injetado no L1 prompt; eval com cases por segmento |
| **`doneWhen` vazio ou genérico** ("melhorar receita") | média | tornar `doneWhen` obrigatório (TODO Onda C); LLM-as-judge marca como "não acionável" |
| **Retry esgotado persistindo plano inválido** | baixa após fix | validação `min(1)` por horizonte no Zod (TODO Onda C); hoje o retry roda 1x e depois throw |
| **Double-approve em concorrência** | baixa | adicionar lock SQL (TODO Onda C) |

---

## 12. Unit economics (C3)

ADR-002 §3.1 obriga recalc de unit economics ao mudar o modelo. Estado atual:

| Item | Valor |
|---|---|
| Modelo | Gemini 2.5 Flash (thinkingBudget 2048) |
| Custo típico por plano gerado | **~R$ 0,12** |
| Preço pretendido SKU `monthly-analysis` | R$ 200–500 / mês |
| Razão custo / preço | ≤ 0,06% (R$0,12 / R$200) — **muito abaixo de C3 25%** |
| Folga para upsell de re-runs | alta — mesmo 10 re-runs/mês ainda fica em ~0,6% |

**Validação C3**: ✅ ratificada por ADR-002. Recalc obrigatório se router trocar de modelo (§3.1 da ADR-002).

---

## 13. Features cobertas (das 60 do Aicfo)

Identificadores: **#13** (plano de ação 3-horizontes), **#45** (priorização por impacto), **#46** (critério de "feita" mensurável).

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

---

## 14. Referências

- Backend implementado: `src/action-plan/{generator,prompts,routes,worker}.ts` (commit `4d5862a`)
- Onda A fix de C4 (PATCH + POST require ASSISTED): commit `2e44531`
- ADR-002 (modelo Gemini Flash + framework de benchmarking): [`docs/adr/002-llm-model-strategy.md`](../adr/002-llm-model-strategy.md)
- Backend doc: [`docs/specs/_backend_action-plan.md`](_backend_action-plan.md)
- Review (6 blockers endereçados aqui): [`docs/specs/_review_action-plan.md`](_review_action-plan.md)
- SKU piloto: [`src/skus/monthly-analysis/spec.md`](../../src/skus/monthly-analysis/spec.md)
- Unit economics Onda 0: [`docs/onda-0/unit_economics.md`](../onda-0/unit_economics.md)
