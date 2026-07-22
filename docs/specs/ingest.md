---
module_key: "ingest"
module_name: "Ingest — Parsers de Lançamentos"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "(input layer SKU piloto monthly-analysis)"
target_model_advisory: "n/a — parsing determinístico, sem LLM neste módulo"
c4_thresholds:
  agreement_rate: 0.95
  latency_p95_ms: 8000
  cost_per_outcome_brl: 0.00
  min_run_count: 30
  min_window_days: 14
outcomes:
  - key: "ingest_completed"
    type: "primary"
    billable: false
    description: "≥ minEntries lançamentos extraídos com shape válido e persistidos"
  - key: "ingest_partial"
    type: "secondary"
    billable: false
    description: "0 < entries.length < minEntries OU orphanCount > 0 — bloqueia pipeline downstream"
  - key: "ingest_failed"
    type: "negative"
    billable: false
    description: "Parse error, arquivo corrompido ou 0 entries — nada é persistido além do MonthlyAnalysis em status=failed"
  - key: "new_analysis_triggered"
    type: "side-effect"
    billable: false
    description: "MonthlyAnalysis criado (status=pending) ao receber primeiro ingest válido do par (tenantId, referenceMonth)"
linked_sku_spec: "src/skus/monthly-analysis/spec.md"
linked_backend: "docs/specs/_backend_ingest.md"
linked_review: "docs/specs/_review_ingest.md"
linked_contracts: "docs/contracts/ingest.openapi.yml"
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# Ingest — Parsers de Lançamentos

> Recebe lançamentos do cliente em 4 formatos: planilha colada (clipboard), PDF do contador (texto-selecionável), Excel/CSV (xlsx, xls, csv), formulário manual. Output: `RawLedger[]` persistido em `LedgerEntry` ligado a um `MonthlyAnalysis` (status=pending) e — se atingiu o threshold — enfileira `classification` via BullMQ.

---

## 1. Cláusula contratual de outcome (C2)

> Esta cláusula é legível por advogado e auditável por DeepAgent. Cada outcome abaixo é a única definição que conta — código que se desvie destas frases viola C2.

### 1.1. `ingest_completed`

> "Lançamentos do mês de referência são considerados **ingeridos** quando o agente, a partir de um upload, clipboard ou submissão manual, extrai **≥ `minEntries`** lançamentos com **shape válido** — cada um contendo `date` (ISO `YYYY-MM-DD` dentro do `referenceMonth`), `description` (string não vazia), `amountCents` (inteiro positivo em centavos de BRL) e `direction` (`'credit'` ou `'debit'`) — **E** persiste todos eles em `LedgerEntry` com `tenantId` igual ao do JWT do caller, vinculados a um `MonthlyAnalysis` único para o par `(tenantId, referenceMonth)`, em uma única transação Prisma."

`minEntries` é lido de `Tenant.productConfig.monthlyAnalysis.minEntries` (default `50`). Ver §8.

### 1.2. `ingest_partial`

> "A ingestão é considerada **parcial** quando o parsing extrai entre 1 e `minEntries - 1` lançamentos com shape válido **OU** quando `orphanCount > 0` (linhas reconhecidas como lançamento mas sem todos os campos obrigatórios). Nestes casos o `MonthlyAnalysis` é persistido (status=`pending`) e os `LedgerEntry` válidos são gravados, mas o job de `classification` **não é enfileirado**. O cliente recebe `outcome: 'partial'` + `orphanCount` para revisão manual."

### 1.3. `ingest_failed`

> "A ingestão é considerada **falha** quando (a) o parser lança exceção (formato corrompido, encoding ilegível, PDF escaneado sem texto extraível), **OU** (b) o parser retorna `entries.length === 0`. Nestes casos nenhum `LedgerEntry` é persistido; o `MonthlyAnalysis` (se já existia) tem status mantido em `failed` e o caller recebe `outcome: 'failed'` + `analysisId: null`."

### 1.4. `new_analysis_triggered` (side-effect)

> "Uma **nova análise mensal** é criada quando o primeiro `POST /ingest/upload | /ingest/clipboard | /ingest/manual` válido para um par `(tenantId, referenceMonth)` cria um registro `MonthlyAnalysis` com `status='pending'`. Subsequentes chamadas para o mesmo par **não criam** nova análise — apagam os `LedgerEntry`, `NarrativeCard` e `ActionPlanItem` anteriores e reaproveitam o `analysisId` (re-import idempotente)."

> Este outcome foi **movido para o ingest** vindo da spec do hub: a criação do agregado pertence ao módulo que recebe o input, não ao módulo de visualização. A spec de `hub` documentará apenas leitura.

### 1.5. Três exemplos POSITIVOS

| # | Cenário | Por que é `ingest_completed` |
|---|---|---|
| 1 | Upload `.xlsx` com 142 linhas, todas com data válida em `2026-04`, descrição, valor e sinal | 142 ≥ 50 (default), shape válido, persiste 142 `LedgerEntry` em `analysisId` novo |
| 2 | Clipboard com 67 linhas coladas de Google Sheets, encoding UTF-8 | `parseText` extrai 67 entries válidas, 67 ≥ 50 |
| 3 | Re-import de `.xlsx` com 80 linhas em `referenceMonth=2026-04` (já havia ingest anterior de 142) | Apaga 142 entries antigas + narrativa + plano, persiste 80 novas, reaproveita `analysisId` (idempotente) |

### 1.6. Três exemplos NEGATIVOS

| # | Cenário | Outcome | Justificativa |
|---|---|---|---|
| 1 | Upload `.xlsx` com apenas 32 linhas válidas (resto vazio) | `ingest_partial` | 0 < 32 < 50 → persiste mas não enfileira classification |
| 2 | PDF escaneado (imagem) sem camada de texto | `ingest_failed` | `pdf-parse` retorna `entries.length === 0`; não há OCR no MVP (ver §9 risco PDF) |
| 3 | Upload `.csv` com encoding Latin1 (CP1252) interpretado como UTF-8, gerando todas as descrições corrompidas | `ingest_failed` ou `ingest_partial` (depende se o parser quebra ou apenas perde campos) | Encoding mal detectado → shape inválido → não conta como outcome contratual válido |

---

## 2. Thresholds C4 (pré-contratados)

```yaml
c4_thresholds:
  agreement_rate: 0.95      # em SHADOW, ≥95% dos lançamentos órfãos do agente caem em campos similares aos do revisor humano (Rafael)
  latency_p95_ms: 8000      # parse + persist + enqueue, medido server-side (não inclui upload network)
  cost_per_outcome_brl: 0.00 # ingest não invoca LLM
  min_run_count: 30         # mínimo de ingests em SHADOW antes de avaliar promoção para ASSISTED
  min_window_days: 14       # janela mínima de observação em SHADOW
```

> Estes números são contrato — `/novais-digital:promote` lê deste frontmatter. Mudança exige nova ADR + reaprovação.

---

## 3. Outcomes formais (ligados ao código)

| Outcome | Predicado no código | Fonte canônica |
|---|---|---|
| `ingest_completed` | `entries.length >= minEntries && orphanCount === 0` | `src/ingest/service.ts` (return `buildResult('completed', ...)`) |
| `ingest_partial` | `entries.length > 0 && (entries.length < minEntries || orphanCount > 0)` | `src/ingest/service.ts` |
| `ingest_failed` | `parser throws || entries.length === 0` | `src/ingest/service.ts` (catch + early return) |
| `new_analysis_triggered` | `tx.monthlyAnalysis.create({ status: 'pending', ... })` executado | `src/ingest/service.ts` dentro da transação |

Toda transição é registrada no trace Langfuse via `trace.update({ metadata: { outcome, reason } })`.

---

## 4. Endpoints expostos

Conforme `docs/contracts/ingest.openapi.yml` (gerado pelo Contract Agent):

| Método | Path | Body | Resposta |
|---|---|---|---|
| `POST` | `/ingest/upload` | `multipart/form-data` (`file` + `referenceMonth`) | `IngestResponse` |
| `POST` | `/ingest/clipboard` | `{ text: string, referenceMonth: 'YYYY-MM' }` | `IngestResponse` |
| `POST` | `/ingest/manual` | `{ entries: ManualEntry[], referenceMonth: 'YYYY-MM' }` | `IngestResponse` |

`IngestResponse`:

```ts
{
  outcome: "completed" | "partial" | "failed";
  analysisId: string | null;   // null quando outcome === "failed"
  entryCount: number;
  orphanCount: number;
  requestId: string;           // correlação com logs Pino
}
```

Todos retornam HTTP 200 mesmo em `outcome: 'failed'` (erros de negócio não são 4xx). 4xx é reservado para auth/payload inválido (Zod). 5xx para erro inesperado (Prisma down, etc).

Autenticação: JWT obrigatório. `tenantId` é extraído do claim, **nunca** do body.

---

## 5. Pipeline interno (determinístico, sem LLM)

```
HTTP request
   │
   ▼
[ Fastify route ] ── valida payload (Zod) + extrai tenantId do JWT
   │
   ▼
[ src/ingest/service.ts ]
   │
   ├── trace.start({ name: "ingest", ... })           ← C6
   │
   ├── span("parse") ── dispatch para parser por source
   │       ├── excel.ts  (xlsx)
   │       ├── csv.ts    (papaparse + detecção de colunas)
   │       ├── pdf.ts    (pdf-parse — texto selecionável)
   │       ├── text.ts   (clipboard — heurística TSV/CSV)
   │       └── manual.ts (validação Zod do JSON)
   │
   ├── normalize.ts ── datas, amountCents, direction
   │
   └── span("persist") ── $transaction:
           1. tenant.findUniqueOrThrow + lê minEntries (C8)
           2. monthlyAnalysis.findUnique by (tenantId, referenceMonth)
           3. se existia: deleteMany ledger/narrative/actionPlan; update status=pending
              se não: monthlyAnalysis.create({ status: 'pending' })   ← new_analysis_triggered
           4. ledgerEntry.createMany(entries)
           5. se entries.length >= minEntries: enqueueClassification(analysisId)
```

---

## 6. Telemetria (C6)

Trace Langfuse obrigatório. Implementado em `src/ingest/service.ts`:

```ts
const trace = createTrace({
  name: "ingest",
  tenantId,
  metadata: { referenceMonth, source },
});

const parseSpan = trace.span({ name: "parse", input: { source } });
// ... parseSpan.end({ output: { entryCount, orphanCount } })

const persistSpan = trace.span({ name: "persist", input: { entryCount } });
// ... persistSpan.end({ output: { analysisId, minEntries } })

await trace.update({ metadata: { outcome, reason } });
```

Sem este trace o ingest **não conta como outcome auditável** pelo DeepAgent (gap apontado no `_review_ingest.md` BLOCKER C6).

Custo: `costBrl = 0` em todos os spans (parsing determinístico). O custo agregado da análise mensal é atribuído ao módulo `classification` em diante.

---

## 7. Bifurcação por modo C4

O ingest **isolado não é cobrável** — apenas o outcome final `analysis_delivered` do SKU pai é. Por isso:

- **SHADOW / ASSISTED / AUTONOMOUS**: o ingest **sempre** persiste e responde com o mesmo shape de `IngestResponse`. Não há bifurcação no endpoint.
- A bifurcação por modo acontece **downstream** (hub decide se entrega ou não a análise final ao cliente).
- O `subscription.mode` é lido apenas para **registro no trace** (`metadata.mode`), não para alterar comportamento.

Esta posição resolve o BLOCKER C4 do `_review_ingest.md`: ingest é declarado como **pre-shadow infrastructure**, e o gate de C4 vive em `hub` + `dre-narrative`.

---

## 8. Configuração por tenant (C8)

Sem hardcode. Threshold `minEntries` lido de `Tenant.productConfig`:

```jsonc
// Tenant.productConfig (JSONB)
{
  "monthlyAnalysis": {
    "minEntries": 50,            // default; tier light pode usar 20, enterprise 100
    "allowFuturePeriods": false  // se true, permite referenceMonth > currentMonth
  }
}
```

Sem hardcode `if (tenantId === '...')` em `src/ingest/**` — hook `tenant-config-guard` bloqueia.

---

## 9. Edge cases críticos e riscos

| # | Risco | Mitigação no MVP | Decisão futura |
|---|---|---|---|
| 1 | **Encoding CP1252 vs UTF-8** em planilhas BR legadas | Detecção via `chardet` no parser CSV; fallback para Latin1 se UTF-8 falha em validação | ADR se >10% dos ingests reais caem em `failed` por encoding |
| 2 | **PDF escaneado (imagem) sem OCR** | Retorna `ingest_failed` com `reason: 'pdf_no_text_layer'`; mensagem clara para o cliente | ADR-003 (proposta) decide entre Tesseract local vs Textract AWS quando taxa de falha PDF > 15% |
| 3 | **Race condition em uploads concorrentes** para mesmo `(tenantId, referenceMonth)` | Índice único composto `(tenantId, referenceMonth)` no Prisma + tratativa de `P2002` no service (último write wins, log warning) | Lock pessimista PG se conflitos > 1% |
| 4 | **`referenceMonth` futuro** (ex: "2099-12") | Validação Zod: `referenceMonth <= currentMonth + 1` (permite mês corrente + próximo para fechamentos antecipados); pode ser desbloqueado via `productConfig.monthlyAnalysis.allowFuturePeriods` (C8) | — |
| 5 | **Double-upload do mesmo mês** (cliente re-importa) | Comportamento idempotente: apaga ledger/narrative/actionPlan anteriores e re-cria. Cliente é avisado via UI antes de confirmar (responsabilidade do frontend) | Backend pode adicionar `?force=true` requirement se SHADOW mostrar perda acidental de narrativas revisadas |
| 6 | **Threshold por tenant** | Lido de `productConfig.monthlyAnalysis.minEntries` (C8); default 50 | Tiers de subscription podem definir defaults diferentes via `billing` |
| 7 | **Mistura de locales no mesmo arquivo** (decimal `,` e `.`) | Detecção heurística por amostra das primeiras 20 linhas; em conflito → `orphanCount++` | Reportar via SUGGESTION no review se incidência > 5% |
| 8 | **DoS por upload gigante** | `MAX_ENTRIES_PER_INGEST = 50_000` validado no Zod do payload `manual` e no count pós-parse | — |

---

## 10. Eval suite mínima

**Localização**: `evals/ingest/cases/` (a criar — atualmente ausente, BLOCKER do `_review_ingest.md`).

**Casos mínimos**: ≥30 (gate para promover `monthly-analysis` de SHADOW → ASSISTED).

**Distribuição obrigatória**:

| Bucket | % mínimo | Conteúdo |
|---|---|---|
| **parsing real** | ≥40% (12+ casos) | Arquivos reais anonimizados de PMEs (com consentimento): xlsx do Conta Azul, CSV do Nibo, extrato bancário PDF, Excel manual da contadora |
| **synthetic** | ≤40% (até 12 casos) | Gerados programaticamente: variar shape, encoding, número de linhas, mix de locales |
| **edge** | ≥10% (3+ casos) | Re-import, exatamente `minEntries`, exatamente `minEntries - 1`, mês fronteira (último dia) |
| **adversarial** | ≥10% (3+ casos) | PDF escaneado, CSV com 90% de linhas inválidas, payload `manual` com 50_001 entries, referenceMonth `2099-12` |

Cada caso declara: `input`, `expected_outcome` (`completed`/`partial`/`failed`), `expected_entry_count_range`, `expected_orphan_count_max`.

Runner: `/novais-digital:eval --module ingest` compara saída do parser com gabarito via `exact_match` em `outcome` + `range_match` em counts.

---

## 11. Critério de pronto (DoD)

Spec considerada satisfeita pelo backend quando:

- [x] Endpoints `POST /ingest/{upload,clipboard,manual}` implementados (`src/ingest/routes.ts`)
- [x] Parsers Excel/CSV/PDF/text/manual (`src/ingest/parsers/`)
- [x] Normalização (`src/ingest/normalize.ts`)
- [x] Persistência idempotente em `$transaction` (`src/ingest/service.ts`)
- [x] Threshold por tenant via `productConfig.monthlyAnalysis.minEntries` (C8)
- [x] Trace Langfuse `ingest` com spans `parse` + `persist` (C6)
- [ ] Eval suite ≥30 casos em `evals/ingest/cases/` (BLOCKER aberto)
- [ ] Teste de isolamento multi-tenant explícito (BLOCKER aberto — `_review_ingest.md`)
- [ ] Detecção e teste de encoding CP1252 (WARNING aberto)
- [ ] Índice único `(tenantId, referenceMonth)` na migration Prisma (WARNING aberto)
- [ ] Validação Zod de `referenceMonth ≤ currentMonth + 1` (WARNING aberto)

Promoção para `status: stable` exige todos os checkboxes marcados.

---

## 12. Features cobertas (das 60 do Aicfo)

Identificadores: input layer do SKU piloto `monthly-analysis` (suporta features #1, #2, #3 do mapeamento de produto — entrada de dados em 4 modalidades).

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

---

## 13. Histórico de versões

| Versão | Data | Mudança | Autor |
|---|---|---|---|
| 0.1.0 | 2026-05-08 | Stub inicial | Rafael Novaes |
| 0.2.0 | 2026-05-12 | Promovido `stub` → `detailed` — cláusula C2 literal por outcome, c4_thresholds declarados, `new_analysis_triggered` movido do hub, edge cases e eval suite especificados | Spec Agent (Claude Opus 4.7) |
