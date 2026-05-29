---
artifact_id: "cashflow"
module_id: "cashflow"
client_id: "aicfo"
plan_version: "0.1.0"
plan_variant: "platform"
spec_path: "docs/specs/cashflow.md"
spec_version: "0.1.0"
forge_command_version: "plan@0.2.0"
linked_principles: [C2, C5, C6, C7, C8]
linked_spec: "docs/specs/cashflow.md"
linked_process_map: "docs/clients/aicfo/process-monthly-analysis-2026-05-25.md"
linked_baseline_cost: "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md"
ai_enabled: false
aios_tier: "B"
generated_at: "2026-05-28"
---

# Plano Técnico — `cashflow`

---

## 1. Escopo derivado da spec

**Outcome literal (C2):**
> O dashboard de Fluxo de Caixa é considerado **carregado** quando o backend retorna, em resposta a `GET /cashflow`, um payload contendo: (i) `summary` com `openingBalanceCents`, `closingBalanceCents`, `totalCreditsCents`, `totalDebitsCents`, `creditCount` e `debitCount`; (ii) série temporal `chart` com N períodos conforme `granularity` solicitada, cada um com `period`, `creditsCents` e `debitsCents`; e (iii) array `table` com pelo menos uma entrada de categoria contendo `category`, `totalCents` e `byPeriod` — tudo filtrado exclusivamente pelo `tenantId` extraído do JWT. A resposta deve completar em **menos de 800 ms (p95)**.

**Outcomes declarados:** `cashflow_loaded`

**C4 thresholds:**
```yaml
agreement_rate: 1.00
latency_p95_ms: 800
cost_per_outcome_brl: 0.00
min_run_count: 30
min_window_days: 14
```

**Fontes de input:**
- `LedgerEntry` (tenantId + date + amountCents + direction + confirmedCategory)
- `MonthlyAnalysis.openingBalanceCents` (saldo inicial — Fase 1 MVP)
- `CashflowPeriod` (saldo standalone — Fase 2)

---

## 2P. Camadas de código — platform (C5 / C7)

| Camada | Path proposto | Responsabilidade | Princípio |
|---|---|---|---|
| Route handler | `src/cashflow/routes.ts` | Recebe GET /cashflow + GET /cashflow/summary; valida JWT e query params | C5 Tier L1 |
| Service layer | `src/cashflow/service.ts` | Orquestra queries paralelas; calcula closingBalance; serializa response | C5 Tier L1 |
| Query builders | `src/cashflow/queries.ts` | Prisma raw groupBy por direction/category/period; isolados e testáveis | C5 Tier L2 |
| Zod schemas | `src/cashflow/schema.ts` | Validação de query params + response shape | C7 |
| Types | `src/cashflow/types.ts` | CashflowSummary, ChartEntry, TableRow — sem dependências de SDK | C7 |
| Pino logger | `src/observability/logger.ts` | Logger estruturado compartilhado (já existe) | C6 |

> **Nenhuma dependência de SDK de LLM** em `src/cashflow/`. Proibido importar `langfuse`, `@google/genai`, `openai` ou `@anthropic-ai/sdk` em qualquer arquivo deste módulo. Gate G1 do `pre-merge-check` enforça.

> **TenantContext exclusivamente via JWT claim** — proibido receber `tenantId` como query param ou body (C8). Qualquer `?tenantId=` na query é ignorado silenciosamente.

---

## 3. Fluxo de dados

```
GET /cashflow?startDate=X&endDate=Y&granularity=monthly

1. auth middleware    → extrai tenantId do JWT; 401 se ausente/inválido
2. zod validation    → valida startDate, endDate, granularity; 400 se inválido
3. resolveOpening()  → MonthlyAnalysis mais recente antes de startDate
                        (null se não encontrada — não é erro)

4. Promise.all([
     querySummary(tenantId, start, end),
     queryChart(tenantId, start, end, granularity),
     queryTable(tenantId, start, end, granularity)
   ])

5. calcClosingBalance = opening + totalCredits - totalDebits
6. serialize response
7. pino.info({ tenantId, route, latency_ms, creditCount, debitCount, requestId })
8. return 200 { period, summary, chart, table, requestId }
```

**Queries Prisma (queries.ts):**

```ts
// querySummary — 1 query, agregação por direction
await prisma.ledgerEntry.groupBy({
  by: ['direction'],
  where: { tenantId, date: { gte: start, lte: end } },
  _sum: { amountCents: true },
  _count: true,
})

// queryChart — 1 query raw SQL (date_trunc não disponível no groupBy Prisma)
await prisma.$queryRaw`
  SELECT date_trunc(${granularity}, date) AS period,
         direction,
         SUM("amountCents") AS amount,
         COUNT(*) AS count
  FROM "LedgerEntry"
  WHERE "tenantId" = ${tenantId}
    AND date >= ${start} AND date <= ${end}
  GROUP BY 1, 2
  ORDER BY 1
`

// queryTable — 1 query raw SQL
await prisma.$queryRaw`
  SELECT "confirmedCategory" AS category,
         date_trunc(${granularity}, date) AS period,
         direction,
         SUM("amountCents") AS amount
  FROM "LedgerEntry"
  WHERE "tenantId" = ${tenantId}
    AND date >= ${start} AND date <= ${end}
  GROUP BY 1, 2, 3
  ORDER BY 1, 2
`
```

**Índices necessários** (já existem ou serão adicionados via migration):
```sql
-- Já existe:
@@index([tenantId])
@@index([date])
-- Adicionar (migration Fase 1):
@@index([tenantId, date])
@@index([tenantId, confirmedCategory])
```

---

## 4P. Pontos de log / observabilidade (C6 — módulo sem LLM)

| Ponto | Evento | Campos obrigatórios no log |
|---|---|---|
| Request recebida | `cashflow.request.start` | `tenantId`, `requestId`, `startDate`, `endDate`, `granularity` |
| Queries concluídas | `cashflow.queries.done` | `tenantId`, `requestId`, `latency_ms`, `creditCount`, `debitCount` |
| Opening balance | `cashflow.opening.resolved` | `tenantId`, `source` (`monthlyAnalysis` \| `null`), `balanceCents` |
| Response enviada | `cashflow.request.end` | `tenantId`, `requestId`, `status`, `latency_ms`, `chartPoints`, `tableRows` |
| Erro | `cashflow.request.error` | `tenantId`, `requestId`, `errorClass`, `message` |

> Trace Langfuse **não obrigatório** (módulo sem LLM). Pino logger obrigatório em todos os 5 pontos acima. Ausência de log em qualquer ponto = violação C6.

---

## 5. TenantContext (C8)

```ts
// Único ponto de entrada do tenantId — claim do JWT
const { tenantId } = req.auth  // extraído pelo auth middleware existente

// Todas as queries:
where: { tenantId }  // nunca query param ou variável de código
```

**Proibido:**
- `if (tenantId === 'demo-tenant') { return mockData }`
- `const tenantId = req.query.tenantId` (ignorar silenciosamente se presente)
- Qualquer hardcode de tenant em `src/cashflow/**`

**Configuração futura por tenant (Fase 2):**
- `Tenant.config.cashflow.defaultGranularity` — lido em runtime, não em código

---

## 6P. Cronograma (DRAFT → CANONICAL)

| Fase | Output entregável | Estimativa | Gate para próxima |
|---|---|---|---|
| **DRAFT** | spec v0.1.0 aprovada + este plan | ✅ concluído | spec assinada |
| **STAGING** | backend implementado + testes passing (≥30 casos) + índices migration | 3–4 dias | CI verde + `latency_p95 < 800ms` em stress test |
| **PILOT** | módulo em uso com ≤50 tenants, `agreement_rate=1.00` por 14 dias | 14+ dias | acceptance-report.md assinado por Rafael |
| **CANONICAL** | `pilot-state.md` mostra ≥14d em PILOT + zero incidente cross-tenant | — | promoção via `/acme:promote` |

---

## 7. Riscos identificados

- [x] **Risco de performance**: queries com `date_trunc` em raw SQL sobre `LedgerEntry` sem índice composto `(tenantId, date)` → timeout em tenants grandes. **Mitigação**: adicionar índice `(tenantId, date)` na migration de Fase 1; stress test com 10k lançamentos no eval adversarial.

- [x] **Risco de dado**: `openingBalanceCents` em `MonthlyAnalysis` é opcional (`null` permitido) e acoplado à análise mensal — para períodos livres (ex: trimestral) o saldo inicial pode ser da análise de 2 meses atrás. **Mitigação**: retornar `null` com transparência no response; frontend exibe "Saldo inicial não disponível"; Fase 2 resolve com `CashflowPeriod`.

- [x] **Risco de qualidade de dados**: `confirmedCategory` null em lançamentos recém-importados (antes de classificação rodar). **Mitigação**: fallback para `predictedCategory` com flag `isFallback: true`; documentado na spec EC8.

- [x] **Risco de segurança (cross-tenant)**: query sem filtro `tenantId` correto. **Mitigação**: teste de segurança obrigatório (EC7 + EC-security-1) no eval suite; code review obrigatório em `src/cashflow/queries.ts`.

- [x] **Risco de granularity=daily em período longo**: 365 dias com granularity=daily gera chart com 365 entradas → payload grande. **Mitigação**: limite de 366 entradas no chart (error 400 se ultrapassado); documentado no Zod schema.

---

## 8P. Critérios de pronto do plan

- [x] Seções 1–7 preenchidas com referência rastreável à spec
- [x] Nenhum SDK de LLM mencionado em `src/cashflow/` — módulo de leitura pura
- [x] 5 pontos de observabilidade Pino declarados (C6)
- [x] TenantContext via JWT claim documentado; proibições explícitas (C8)
- [x] Cronograma com janela mínima PILOT de 14 dias declarada (C4)
- [x] 5 riscos identificados com mitigação (não `none`)
- [x] Índices Prisma necessários identificados
- [x] Próximo passo: `/acme:tasks --artifact_id=cashflow`

---

## 9. Classificação AIOS

| Módulo | Tier | Justificativa | Agentes envolvidos |
|---|---|---|---|
| `cashflow` | **B** | Módulo sem LLM, lógica de negócio clara (agregação), sem ambiguidade de domínio; agente itera, Rafael revisa PRs | spec_agent → schema_agent + test_agent (paralelo) → backend_agent → frontend_agent + review_agent (paralelo) |

**Agentes já scaffoldados:** `aios/agents/cashflow/` contém spec_agent, backend_agent, frontend_agent, review_agent, schema_agent, test_agent.

**Ordem de execução AIOS (Fase 1 MVP):**

```
Onda 1 (paralelo):
├── schema_agent   → confirma schema existente suficiente para MVP + propõe índices
└── test_agent     → gera ≥30 casos TDD-RED para cashflow_loaded

Onda 2 (sequencial após onda 1):
└── backend_agent  → implementa src/cashflow/ para fazer testes ficarem GREEN

Onda 3 (paralelo):
├── frontend_agent → Contract Agent: docs/contracts/cashflow.openapi.yml + handoff
└── review_agent   → valida C5/C6/C7/C8 no código gerado
```

**C7 — Portabilidade**: nenhuma dependência de SDK LLM em `src/cashflow/`. Backend_agent proibido de importar qualquer cliente de modelo.

**C8 — Anti-heroic**: `tenantId` vem exclusivamente de `req.auth.tenantId` (JWT). Backend_agent usa `task_input.tenantId` nos testes, nunca valor hardcoded.

**Próximo passo:** `/acme:tasks --artifact_id=cashflow --client_id=aicfo`
