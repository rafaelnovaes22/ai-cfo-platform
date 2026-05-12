---
module_key: "hub"
module_name: "Hub — Home + Análises Anteriores"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "#23"
target_model_advisory: "n/a"
c4_thresholds:
  agreement_rate: 1.00
  latency_p95_ms: 500
  cost_per_outcome_brl: 0.00
  min_run_count: 30
  min_window_days: 14
outcomes:
  - hub_loaded
  - history_listed
related_adrs: ["002"]
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# Hub — Home + Análises Anteriores

> Tela home pós-login. Apresenta snapshot da última análise (DRE 5-fields + counts de cards + summary do plano por horizonte) e lista cronológica das últimas 12 análises. Não cria, não edita, não dispara LLM — é o **aggregator de leitura** que materializa os outcomes produzidos por `ingest`, `classification`, `dre-narrative` e `action-plan`.

## Sumário

| Item | Valor |
|---|---|
| Outcomes formais | `hub_loaded`, `history_listed` |
| Endpoints | `GET /hub`, `GET /analyses` |
| LLM | **Nenhum** — leitura determinística do Postgres via Prisma |
| Latência p95 alvo | 500 ms (consulta com `include` aninhado em até 2 tabelas) |
| Custo por outcome | R$ 0,00 (sem inferência — só DB + serialização) |
| Multi-tenancy | `where: { tenantId: req.auth.tenantId }` em toda query (C8) |
| Telemetria | Pino logger estruturado por request; trace Langfuse opcional |

---

## 1. Cláusula contratual de outcome (C2)

### 1.1. `hub_loaded`

**Cláusula literal (consumida em contrato com cliente):**

> O snapshot do hub é considerado **carregado** quando o agente retorna, em resposta a `GET /hub`, um payload contendo: (i) `subscription` com `plan`, `mode` e `status`; e (ii) `latestAnalysis` com `id`, `referenceMonth`, `status`, `mode`, DRE (5 campos — `grossRevenue`, `deductions`, `netRevenue`, `costs`, `netIncome`), contagens por tipo de narrative card (`positive`, `attention`, `risk`) e `actionPlan.summary` com totais por horizonte; **ou** `latestAnalysis: null` quando o tenant ainda não possui nenhuma análise. A resposta deve completar em **menos de 500 ms (p95)**, medida do início do handler ao envio do último byte.

**Exemplos POSITIVOS** (atende a cláusula):

1. Tenant ativo com 1 análise `ready`: payload traz `subscription.plan="essencial"`, `subscription.mode="assisted"`, `latestAnalysis.id`, `referenceMonth="2026-04"`, DRE com 5 campos numéricos populados, cards `{positive:2,attention:1,risk:1}`, actionPlan.summary `[{horizon:"30d",count:3,totalImpactCents:150000}, ...]`, em 220 ms.
2. Tenant novo, zero análises: payload traz `subscription` válida e `latestAnalysis: null`, em 80 ms.
3. Tenant com análise `generating` (regeneração em andamento): payload traz `latestAnalysis.status="generating"`, DRE da geração anterior preservada, em 310 ms.

**Exemplos NEGATIVOS** (viola a cláusula):

1. Resposta omite `subscription.mode` → frontend não consegue aplicar gating de C4 — **falha**.
2. `latestAnalysis.dre` traz 4 dos 5 campos (sem `netIncome`) → contrato quebrado, payload incompleto — **falha**.
3. Resposta volta em 1.4s (p95 estourado) → SLA violado, mesmo com payload correto — **falha**.

### 1.2. `history_listed`

**Cláusula literal:**

> O histórico é considerado **listado** quando o agente retorna, em resposta a `GET /analyses`, uma lista das **até 12 análises mais recentes** do tenant autenticado, ordenadas por `referenceMonth DESC`, contendo para cada uma: `id`, `referenceMonth`, `status`, `mode`, `deliveredAt`, `approvedAt`, `costCents` e `totalImpactCents`. Tenants com menos de 12 análises recebem somente as existentes; tenants sem análises recebem lista vazia. SLA: latência p95 < 500 ms.

**Exemplos POSITIVOS:**

1. Tenant com 8 análises: retorna 8 itens ordenados de `2026-04` até `2025-09`, todas com summary completo, em 180 ms.
2. Tenant com 25 análises: retorna apenas as 12 mais recentes (truncado por `take: 12`), em 240 ms.
3. Tenant novo: retorna `[]`, em 60 ms.

**Exemplos NEGATIVOS:**

1. Resposta retorna 13 análises (ignora `take: 12`) → contrato de v1 quebrado — **falha**.
2. Análise listada com `totalImpactCents` ausente (campo undefined) → schema OpenAPI inválido — **falha**.
3. Ordem `referenceMonth ASC` em vez de DESC → quebra UX (mais antiga no topo) — **falha**.

### 1.3. Outcome removido — `new_analysis_triggered`

O outcome `new_analysis_triggered`, originalmente declarado no stub deste módulo, foi **migrado para o módulo `ingest`** nesta promoção. Justificativa:

- Criar uma nova `MonthlyAnalysis` é responsabilidade de quem **ingere lançamentos**: `POST /ingest/upload`, `POST /ingest/clipboard` e `POST /ingest/manual` (vide `src/ingest/routes.ts`). O hub não expõe endpoint de criação e jamais deveria — é estritamente leitura.
- Manter o outcome aqui violava **C2 (outcome-first)**: a spec declarava algo que o backend não implementava, gerando BLOCKER no review AIOS (`_review_hub.md`, 2026-05-12).

**Ver `docs/specs/ingest.md`** para a cláusula formal de `new_analysis_triggered`.

---

## 2. Endpoints expostos

Contratos completos em `docs/contracts/hub.openapi.yml`. Resumo abaixo.

### 2.1. `GET /hub`

| Item | Detalhe |
|---|---|
| Auth | Bearer JWT (claim `tenantId` obrigatório) |
| Query | nenhum (params espúrios são ignorados) |
| Response 200 | `{ subscription, latestAnalysis | null, requestId }` |
| Response 401 | `ProblemDetail` — JWT inválido/ausente |
| Response 500 | `ProblemDetail` — falha de persistência |
| Header | `X-Request-Id` ecoado |
| Persistência | `prisma.subscription.findFirst` + `prisma.monthlyAnalysis.findFirst` com `include: { narrativeCards, actionItems }`, ambos filtrados por `tenantId` |

### 2.2. `GET /analyses`

| Item | Detalhe |
|---|---|
| Auth | Bearer JWT |
| Query | nenhum em v1 (paginação fixa) |
| Response 200 | `{ analyses: AnalysisSummary[], requestId }` |
| Response 401 | `ProblemDetail` |
| Response 500 | `ProblemDetail` |
| Persistência | `prisma.monthlyAnalysis.findMany({ where: { tenantId }, orderBy: { referenceMonth: 'desc' }, take: 12 })` |

---

## 3. C4 thresholds

```yaml
agreement_rate: 1.00       # leitura determinística — sem julgamento de IA, 100% reprodutível
latency_p95_ms: 500        # consulta DB com no máximo 2 includes
cost_per_outcome_brl: 0.00 # zero LLM
min_run_count: 30          # window mínima de execuções antes de promover
min_window_days: 14        # janela temporal mínima de observação
```

Justificativa de `agreement_rate: 1.00`: como a operação é leitura DB serializada para JSON, qualquer divergência entre runs é bug (não variação aceitável de modelo). Diferente dos módulos com LLM, onde `agreement_rate` < 1 é tolerável.

---

## 4. Target model advisory

`n/a` — módulo de leitura agregada, **não invoca LLM**. Ratificado pela ADR-002 (vide §2.3 da ADR: specs declaram modelo só quando há inferência). Nenhum import de `@anthropic-ai/sdk`, `@google/generative-ai` ou similar deve aparecer em `src/hub/**` (gate G1 do `pre-merge-check` aplica).

---

## 5. C4 enforcement (modo shadow) — defesa em profundidade

**Estado atual (Onda 1):** o backend retorna o snapshot completo (`dre`, `cards`, `actionPlan`) independentemente do `subscription.mode`, e expõe `mode: "shadow"` no payload. O frontend é responsável por **esconder/bloquear CTAs** e o resumo de análise quando `mode === "shadow"`.

**Risco aberto (WARNING de `_review_hub.md`):** se o frontend tiver bug ou for contornado (ex: chamada direta à API), o cliente em modo shadow vê análise não-validada — fere o espírito de C4 ("SHADOW antes de cobrar/entregar").

**TODO Onda C — defesa backend-side:**

- Em `mode === "shadow"`, redactar campos sensíveis do response: `latestAnalysis.dre = null`, `latestAnalysis.cards = []`, `latestAnalysis.actionPlan = null`.
- Exceção: usuário autenticado é o operador humano (Rafael) — payload completo é entregue para revisão paralela (esse é justamente o uso legítimo de SHADOW).
- Histórico (`GET /analyses`) já é seguro: o summary não expõe DRE/cards/actionPlan.

Acompanhar como **WARNING aberto** em `_review_hub.md` até implementação na Onda C.

---

## 6. Edge cases

| # | Caso | Comportamento esperado |
|---|---|---|
| EC1 | Tenant novo sem análise | `latestAnalysis = null`; status 200 |
| EC2 | Análise existe mas sem DRE (status `pending`/`generating`) | `latestAnalysis.dre = null` (campos individuais ausentes) |
| EC3 | Análise existe sem narrative cards | `latestAnalysis.cards = { positive: 0, attention: 0, risk: 0 }` |
| EC4 | Análise existe sem action plan | `latestAnalysis.actionPlan = null` |
| EC5 | DRE com `netIncome` negativo (prejuízo) | Serializar normalmente; sinal preservado |
| EC6 | `totalImpactCents` negativo (ação destrói valor) | Passar adiante; **não** aplicar `Math.abs` no backend (frontend decide apresentação) |
| EC7 | `deliveredAt`/`approvedAt` null (análise não entregue/aprovada) | Serializar como `null` no JSON |
| EC8 | `costCents` null (análise sem custo registrado) | Serializar como `null` |
| EC9 | Tenant tem >12 análises | Retornar apenas as 12 mais recentes (v1) — sem cursor |
| EC10 | JWT do tenant B com `?tenantId=A` na query | Ignorar query param; filtrar por claim do JWT (defesa C8) |
| EC11 | Análise em `generating` (regeneração) | Retornar payload da geração anterior; frontend faz polling |

**Paginação v1:** fixa em 12, sem cursor. **TODO Onda 2+:** introduzir paginação cursor-based para clientes com >12 meses de histórico. Decisão registrada aqui em vez de ADR separada porque o impacto é limitado e a reversão é trivial (adicionar query params opcionais, manter default em 12).

---

## 7. Configuração por tenant (C8)

**Nenhuma.** Hub não tem feature flag, threshold ou prompt por tenant. Os únicos dados específicos de tenant que chegam ao response são:

1. `subscription.mode` (lido do tenant do JWT)
2. Dados das análises do tenant (filtradas via `where: { tenantId }`)

Multi-tenancy é garantida exclusivamente por `req.auth.tenantId` (claim do JWT). Nenhum hardcode de tenant em `src/hub/**`. Query params como `?tenantId=` são ignorados (defesa contra tentativas de cross-tenant).

---

## 8. Eval suite mínima

Localização: `evals/hub/cases/`. Mínimo **≥30 casos** (C4 hard gate), distribuídos como:

| Categoria | Quantidade alvo | Cobertura |
|---|---|---|
| `hub_loaded` happy path | 6 | combinações `{plan} × {mode}` × análise ready |
| `hub_loaded` edge | 8 | EC1–EC5, EC7, EC8, EC11 |
| `hub_loaded` C4-shadow | 3 | modo shadow com/sem operador humano (preparação Onda C) |
| `history_listed` happy path | 4 | 0/1/8/12 análises |
| `history_listed` edge | 4 | EC6, EC8, EC9, ordem DESC |
| `auth/security` | 5 | 401 sem JWT, 401 JWT expirado, EC10 cross-tenant, header X-Request-Id, 500 db down |

**Modo de avaliação:** `exact_match` / `assertion shape` — **não LLM-as-judge**. Cada caso declara payload esperado completo (ou subset com `pick`); o runner compara via deep-equal estrutural. Como não há LLM no path, variância esperada é 0%.

Runner: `npm run eval -- --module hub` (invoca rotina determinística, sem custo).

---

## 9. Telemetria (C6)

Hub **não consome LLM**, portanto trace Langfuse não é obrigatório por C6. Entretanto:

- **Obrigatório:** logger Pino estruturado em cada GET, com campos `{ tenantId, route, status, latency_ms, requestId }`.
- **Recomendado:** trace Langfuse de cada request com `kind: "read"`, `cost_brl: 0`, latency_ms — não há `generation` para observar, mas o trace ajuda a correlacionar com runs do pipeline upstream (ingest/dre/action).
- **Métricas Fastify** (`@fastify/under-pressure` ou plugin de prom-metrics) para alimentar dashboard de SLA p95.

Sem trace mínimo de latência, o gate G3 do `pre-merge-check` (telemetria) passa por exceção (`n/a por design`), mas o logger Pino é mandatório.

---

## 10. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| **Cross-tenant leakage** via filtro incorreto | Alta | Toda query usa `where: { tenantId: req.auth.tenantId }`; testes EC10 + R6/R11 do test plan validam; revisão de PR obrigatória em `src/hub/routes.ts` |
| **Performance degradada** com tenant grande (>12 meses) | Média | `take: 12` hardcoded em v1; índice composto `(tenantId, referenceMonth DESC)` em `MonthlyAnalysis`; migrar para cursor na Onda 2 |
| **Snapshot stale** durante regeneração | Baixa | Backend retorna `status="generating"`; frontend faz polling; sem cache server-side |
| **Esquecimento de `include`** em refactor do Prisma | Média | Teste unitário verifica argumento `include: { narrativeCards: true, actionItems: true }` passado ao Prisma (sugestão do review, item R1) |
| **Bypass de C4 shadow** via call direta à API | Média | Atualmente delegado ao frontend; mitigação backend-side prevista para Onda C (§5) |
| **DRE com valores negativos mal-renderizados** | Baixa | Backend não aplica `Math.abs`; frontend decide apresentação; helpers de formatação documentados no handoff |
| **Drift entre OpenAPI e implementação** | Baixa | `docs/contracts/hub.openapi.yml` gerado pelo Contract Agent; CI compara schema Zod ↔ rotas (G4 do `pre-merge-check`) |

---

## 11. Promoção (C4 lifecycle)

| Modo | Critério de entrada | Status atual |
|---|---|---|
| SHADOW | spec detalhada + backend implementado + ≥30 eval cases passing | **disponível** (post-merge desta spec) |
| ASSISTED | 30 runs em SHADOW em ≥14 dias com `agreement_rate=1.00` + `latency_p95<500ms` + aprovação humana cruzada | aguarda runtime SHADOW |
| AUTONOMOUS | 100 runs em ASSISTED com `agreement_rate=1.00` + zero incidente de cross-tenant + defesa C4 backend-side (Onda C) implementada | bloqueado por §5 |

Promoções via `/acme:promote --subscription {id} --to {mode}`.

---

## 12. Features cobertas (das 60 do Aicfo)

Identificadores: **#23** (Hub home + histórico). Mapeamento completo em `docs/product-vision.md`.

---

## 13. Histórico

| Data | Mudança | Autor |
|---|---|---|
| 2026-05-08 | Stub inicial (Onda 1 planning) | Rafael Novaes |
| 2026-05-11 | Backend implementado (commit `8f51c09`) | Rafael Novaes |
| 2026-05-12 | Promoção de `stub` → `detailed`; outcome `new_analysis_triggered` migrado para `ingest`; c4_thresholds + target_model_advisory adicionados; ADR-002 vinculada | Rafael Novaes (via Spec Agent) |
