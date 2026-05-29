---
module_key: "cashflow"
module_name: "Cashflow — Fluxo de Caixa"
wave: 2
tier: "B"
status: "detailed"
ai_enabled: false
criticality: "standard"
constitution_version: "0.3.0"
features_covered: "#2, #3, #57"
c4_thresholds:
  agreement_rate: 1.00
  latency_p95_ms: 800
  cost_per_outcome_brl: 0.00
  min_run_count: 30
  min_window_days: 14
outcomes:
  - cashflow_loaded
related_adrs: []
linked_process_map: "docs/clients/aicfo/process-monthly-analysis-2026-05-25.md"
linked_baseline_cost: "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md"
created_at: "2026-05-08"
last_updated: "2026-05-28"
version: "0.1.0"
---

# Cashflow — Fluxo de Caixa

> Visão do fluxo de caixa por período (diário, semanal, mensal, trimestral): saldo inicial, saldo acumulado, entradas, saídas, série temporal de 12 meses e tabela de categorias por subperíodo. Módulo de leitura — **sem LLM**, 100% determinístico via Prisma sobre `LedgerEntry` existente.

---

## 1. Cláusula contratual de outcome (C2)

### 1.1. `cashflow_loaded`

**Cláusula literal:**

> O dashboard de Fluxo de Caixa é considerado **carregado** quando o backend retorna, em resposta a `GET /cashflow`, um payload contendo: (i) `summary` com `openingBalanceCents`, `closingBalanceCents`, `totalCreditsCents`, `totalDebitsCents`, `creditCount` e `debitCount`; (ii) série temporal `chart` com N períodos conforme `granularity` solicitada, cada um com `period`, `creditsCents` e `debitsCents`; e (iii) array `table` com pelo menos uma entrada de categoria contendo `category`, `totalCents` e `byPeriod` — tudo filtrado exclusivamente pelo `tenantId` extraído do JWT. A resposta deve completar em **menos de 800 ms (p95)**, medida do início do handler ao último byte.

**Exemplos POSITIVOS** (atendem a cláusula):

| # | Cenário | Evidência observável |
|---|---|---|
| 1 | Tenant com 142 lançamentos em jan–mar/2026, granularity=monthly | summary com 4 campos numéricos, chart com 3 entradas (jan/fev/mar), table com ≥1 categoria, latência < 400 ms |
| 2 | Tenant sem lançamentos no período selecionado | summary zerado (`totalCreditsCents: 0`, `totalDebitsCents: 0`, `creditCount: 0`, `debitCount: 0`), `chart: []`, `table: []`, status 200 |
| 3 | Tenant com 500 lançamentos, granularity=daily, período de 90 dias | chart com 90 entradas diárias, table com todas as categorias confirmadas, latência < 800 ms |

**Exemplos NEGATIVOS** (violam a cláusula):

| # | Cenário | Por que NÃO conta |
|---|---|---|
| 1 | Response omite `closingBalanceCents` | Payload incompleto — campo obrigatório do contrato ausente |
| 2 | `chart` retorna períodos de outro tenant (cross-tenant leak) | Violação C8 e de segurança — query sem filtro `tenantId` correto |
| 3 | Latência p95 = 1.200 ms mesmo com payload correto | SLA violado — mesmo que dados estejam certos, contrato de latência não foi cumprido |

### 1.2. Janela temporal de estabilidade

`síncrono` — resposta entregue na mesma requisição HTTP, sem jobs assíncronos.

---

## 2. Endpoints expostos

Contratos completos em `docs/contracts/cashflow.openapi.yml`. Resumo abaixo.

### 2.1. `GET /cashflow`

| Item | Detalhe |
|---|---|
| Auth | Bearer JWT (claim `tenantId` obrigatório) |
| Query params | `startDate` (YYYY-MM-DD, obrigatório), `endDate` (YYYY-MM-DD, obrigatório), `granularity` (`daily` \| `weekly` \| `monthly` \| `quarterly`, default `monthly`), `category` (string, opcional), `bankAccountId` (uuid, opcional — Fase 2) |
| Response 200 | `{ period, summary, chart, table, requestId }` |
| Response 400 | `ProblemDetail` — params inválidos (ex: startDate > endDate) |
| Response 401 | `ProblemDetail` — JWT inválido/ausente |
| Response 500 | `ProblemDetail` — falha de DB |
| Header | `X-Request-Id` ecoado |

**Response schema:**

```ts
{
  period: {
    startDate: string    // "2026-01-01"
    endDate: string      // "2026-03-31"
    granularity: string  // "monthly"
  }
  summary: {
    openingBalanceCents: number | null  // saldo no startDate; null se não informado
    closingBalanceCents: number | null  // openingBalance + créditos − débitos
    totalCreditsCents: number           // soma de todas entradas no período
    totalDebitsCents: number            // soma de todas saídas no período (positivo)
    creditCount: number                 // qtd de lançamentos de entrada
    debitCount: number                  // qtd de lançamentos de saída
  }
  chart: Array<{
    period: string         // "2026-01" (monthly) | "2026-01-01" (daily) | "2026-W01" (weekly)
    creditsCents: number
    debitsCents: number
  }>
  table: Array<{
    category: string          // ex: "Receitas", "Custos Variáveis"
    parentCategory: string | null
    totalCents: number        // soma no período completo (crédito positivo, débito negativo)
    byPeriod: Array<{
      period: string
      amountCents: number
    }>
  }>
  requestId: string
}
```

### 2.2. `GET /cashflow/summary` (alias rápido para WhatsApp / notificações)

| Item | Detalhe |
|---|---|
| Auth | Bearer JWT |
| Query | `date` (YYYY-MM-DD, default hoje) |
| Response 200 | `{ date, balanceCents, creditsCents, debitsCents, requestId }` — resumo do dia |

Usado pela Fase 4 (canal WhatsApp) para notificação diária.

---

## 3. Fonte de dados — mapeamento para schema existente

### Fase 1 MVP (schema inalterado)

| Dado do payload | Fonte no schema | Query |
|---|---|---|
| `totalCreditsCents` | `LedgerEntry.amountCents` where `direction='credit'` | `SUM(amountCents)` com filtros |
| `totalDebitsCents` | `LedgerEntry.amountCents` where `direction='debit'` | `SUM(amountCents)` com filtros |
| `creditCount` / `debitCount` | `LedgerEntry.direction` | `COUNT` agrupado por direction |
| `openingBalanceCents` | `MonthlyAnalysis.openingBalanceCents` mais próximo do `startDate` | `findFirst` por referenceMonth ≤ startDate, desc |
| `chart[].creditsCents` | `LedgerEntry` agrupado por mês/dia | `GROUP BY date_trunc('month', date)` |
| `table[].category` | `LedgerEntry.confirmedCategory` | `GROUP BY confirmedCategory` |

**Nota MVP**: `openingBalanceCents` é lido de `MonthlyAnalysis.openingBalanceCents` do mês imediatamente anterior ao `startDate`. Se não existir análise anterior, retorna `null` — frontend exibe "Saldo inicial não informado".

### Fase 2 (após migration)

Adicionar: `BankAccount`, `BalanceSnapshot`, `CashflowPeriod`, campos `bankAccountId` + `vendor` + `invoiceRef` + `sourceLabel` em `LedgerEntry`. Ver seção §7.

---

## 4. Pipeline de dados (sem LLM)

```
GET /cashflow
  │
  ├─ 1. Validar JWT → extrair tenantId
  ├─ 2. Validar query params (startDate ≤ endDate, granularity válida)
  ├─ 3. Resolver openingBalance ← MonthlyAnalysis mais recente antes de startDate
  │
  ├─ Paralelo (Promise.all):
  │   ├─ 4a. Query summary: COUNT + SUM por direction no período
  │   ├─ 4b. Query chart: GROUP BY período conforme granularity
  │   └─ 4c. Query table: GROUP BY confirmedCategory + período
  │
  ├─ 5. Calcular closingBalance = openingBalance + credits − debits
  ├─ 6. Serializar response
  └─ 7. Emitir Pino log: { tenantId, route, status, latency_ms, requestId }
```

Todas as queries em paralelo via `Promise.all` — latência dominada pela mais lenta (~200–400 ms em tenant mediano).

---

## 5. C4 thresholds

```yaml
agreement_rate: 1.00       # leitura determinística — 100% reprodutível
latency_p95_ms: 800        # 3 queries paralelas + serialização
cost_per_outcome_brl: 0.00 # zero LLM
min_run_count: 30
min_window_days: 14
```

**Justificativa `agreement_rate: 1.00`**: operação de leitura DB com agregação determinística. Qualquer divergência entre runs é bug, não variação aceitável.

---

## 6. Eval suite mínima (≥ 30 casos — C4 hard gate)

Localização: `evals/cashflow/cases/`

| Categoria | Qtd alvo | Cobertura |
|---|---|---|
| `cashflow_loaded` happy path — granularity monthly | 6 | 1/2/3 meses com dados, período sem dados |
| `cashflow_loaded` happy path — granularity daily | 4 | 7d, 30d, 90d, dia único |
| `cashflow_loaded` happy path — granularity quarterly | 3 | 1 trimestre, 2 trimestres, ano completo |
| `cashflow_loaded` edge — sem lançamentos | 3 | período futuro, tenant novo, período com só créditos |
| `cashflow_loaded` edge — openingBalance null | 2 | sem MonthlyAnalysis anterior, analysis sem openingBalance |
| `cashflow_loaded` edge — filtro por category | 3 | categoria existente, categoria inexistente, categoria parcial |
| `cashflow_summary` (alias diário) | 3 | dia com lançamentos, dia sem, data futura |
| auth/security | 5 | 401 sem JWT, 401 expirado, cross-tenant (EC-security-1), startDate > endDate, granularity inválida |
| adversarial | 3 | tenant com 10.000 lançamentos (stress), período de 2 anos (daily), categoria com caracteres especiais |

**Modo de avaliação**: `exact_match` / `assertion shape` — **não LLM-as-judge**. Custo: R$ 0.

---

## 7. Edge cases

| # | Caso | Comportamento esperado |
|---|---|---|
| EC1 | Nenhum lançamento no período | summary zerado, `chart: []`, `table: []`, status 200 |
| EC2 | `openingBalanceCents` não disponível (sem MonthlyAnalysis anterior) | `openingBalanceCents: null`, `closingBalanceCents: null`; `totalCreditsCents`/`totalDebitsCents` calculados normalmente |
| EC3 | `confirmedCategory` null em alguns lançamentos | Agrupados como `"Sem categoria"` na tabela |
| EC4 | `startDate === endDate` (período de 1 dia) | Chart com 1 entrada; comportamento normal |
| EC5 | Período de 365 dias com granularity=daily | Chart com até 365 entradas; latência monitorada |
| EC6 | Filtro `category` não existe no período | `table: []`; status 200 (não é erro) |
| EC7 | `tenantId` do JWT diferente do `?tenantId=` na query | Ignorar query param; filtrar por JWT claim (C8) |
| EC8 | Lançamentos sem `confirmedCategory` (só `predictedCategory`) | MVP: usar `predictedCategory` como fallback se `confirmedCategory` for null, com flag `isFallback: true` no response |
| EC9 | granularity=weekly com período que não completa semana | Última entrada da série inclui dias parciais |

---

## 8. Configuração por tenant (C8)

Nenhuma configuração por tenant na Fase 1. Multi-tenancy garantida exclusivamente por `req.auth.tenantId` em toda query.

Fase 2 adicionará:
- `Tenant.config.cashflow.defaultGranularity` — granularidade padrão ao abrir a tela
- `Tenant.config.cashflow.defaultPeriod` — período padrão (ex: `current_quarter`)

---

## 9. Telemetria (C6)

Cashflow **não consome LLM** — trace Langfuse não obrigatório. Obrigatório:

- **Pino logger** em cada GET com `{ tenantId, route, status, latency_ms, requestId, period, granularity, resultCounts }`
- **Recomendado**: trace Langfuse com `kind: "read"`, `cost_brl: 0`, para correlacionar com pipeline upstream quando dashboard é acessado pós-análise

---

## 10. Evolução planejada (fases)

### Fase 1 — MVP (este spec, sem migrations)
- `GET /cashflow` com summary + chart + table
- `GET /cashflow/summary` (alias diário)
- Usa `LedgerEntry` e `MonthlyAnalysis.openingBalanceCents` existentes
- Tela sai de "EM BREVE" com dados reais

### Fase 2 — Schema completo
Migrations adicionais (fora deste spec, em spec v0.2.0):
```prisma
model BankAccount {
  id          String  @id @default(uuid())
  tenantId    String
  name        String            // "Conta Principal Itaú", "Hotmart"
  type        String            // "bank" | "digital" | "marketplace" | "manual"
  institution String?
  externalId  String?           // ID na plataforma de origem
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  ledgerEntries LedgerEntry[]
  balanceSnapshots BalanceSnapshot[]
  @@index([tenantId])
}

model BalanceSnapshot {
  id            String      @id @default(uuid())
  tenantId      String
  bankAccountId String
  date          DateTime
  balanceCents  Int
  @@unique([bankAccountId, date])
  @@index([tenantId, date])
}

model CashflowPeriod {
  id                  String   @id @default(uuid())
  tenantId            String
  startDate           DateTime
  openingBalanceCents Int
  @@unique([tenantId, startDate])
  @@index([tenantId])
}
```
Novos campos em `LedgerEntry`: `bankAccountId`, `vendor`, `invoiceRef`, `sourceLabel`.

### Fase 3 — Integrações externas
Adaptadores Hotmart/outras fontes → `LedgerEntry` via `src/integrations/sources/`.

### Fase 4 — Entrega diária WhatsApp
`GET /cashflow/summary` alimenta notificação diária via `whatsapp-channel`.

---

## 11. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Cross-tenant leakage via filtro incorreto | Alta | Toda query usa `where: { tenantId: req.auth.tenantId }`; testes EC7 + EC-security-1 validam |
| Performance degradada com tenant grande (>10k lançamentos) | Média | Índices em `(tenantId, date)` e `(tenantId, confirmedCategory)` já existem; stress test EC adversarial |
| `openingBalance` desatualizado (análise antiga) | Baixa | MVP usa o mais recente disponível; Fase 2 resolve com `CashflowPeriod` standalone |
| `confirmedCategory` null em lançamentos novos (antes de classificação) | Média | EC8: fallback para `predictedCategory` com flag `isFallback`; usuário ciente |

---

## 12. Promoção (C4 lifecycle)

| Modo | Critério de entrada | Status atual |
|---|---|---|
| SHADOW | spec detalhada + backend implementado + ≥30 eval cases passing | **disponível** (pós-merge desta spec) |
| ASSISTED | 30 runs em SHADOW em ≥14 dias com `agreement_rate=1.00` + `latency_p95<800ms` + aprovação humana | aguarda runtime SHADOW |
| AUTONOMOUS | 100 runs em ASSISTED com `agreement_rate=1.00` + zero cross-tenant + Fase 2 migrations em prod | bloqueado |

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0-stub | 2026-05-08 | Stub inicial — Onda 2 planning |
| 0.1.0 | 2026-05-28 | Promoção de stub → detailed; cláusula de outcome C2; endpoints; edge cases; eval suite; roadmap de fases |
