---
module_key: "export"
module_name: "Export — Relatórios Exportáveis"
wave: 1
tier: "B"
status: "detailed"
constitution_version: "0.2.0"
features_covered: "#28, #29, #30"
c4_thresholds:
  agreement_rate: 1.00        # determinístico (sem LLM em runtime)
  latency_p95_ms: 3000        # geração PDF (pdfkit + paginação + drain)
  cost_per_outcome_brl: 0.00  # zero LLM
  min_run_count: 30
  min_window_days: 14
target_model_advisory: "n/a"  # sem LLM em runtime; PDF gerado de dados já persistidos (DRE/cards/actions)
outcomes:
  - "report_exported_monthly"
  - "report_exported_investors"
  - "report_exported_partners"
created_at: "2026-05-08"
last_updated: "2026-05-12"
---

# Export — Relatórios Exportáveis

> Gera PDF da análise mensal em 3 sabores: **monthly** (cliente final), **investors** (investidor/board com KPIs comerciais sintetizados) e **partners** (sócios com distribuição estimada de lucro). Renderização determinística a partir de dados já persistidos por `dre-narrative` + `action-plan` — **sem LLM em runtime**.

---

## 1. Cláusula contratual de outcome (C2)

Esta spec declara 3 outcomes auditáveis. Cada um possui uma cláusula literal que define quando o outcome é considerado entregue.

### 1.1. `report_exported_monthly`

> "Um relatório mensal é considerado **exportado** quando o agente retorna um stream `application/pdf` válido (não-zero bytes, abre em qualquer leitor PDF padrão) contendo: (a) DRE Facilitado com 31 linhas estruturadas, (b) 3 cards de narrativa do mês de referência, (c) plano de ação completo com 3 horizontes (short/medium/long), gerado a partir de uma `MonthlyAnalysis` cujo `status` ∈ {`delivered`, `approved`}. Outras condições de status retornam HTTP 422 (`ANALYSIS_NOT_EXPORTABLE`) e não contam como outcome entregue."

**Exemplos positivos:**

1. Tenant em ASSISTED, análise `status=delivered`, `dreJson` preenchido com 31 linhas, 3 cards, 9 actions → PDF de ~120KB entregue → outcome contabilizado.
2. Tenant em AUTONOMOUS, análise `status=approved` após edição do cliente, `clientEditedNarrative` presente (mas v1 renderiza dados originais — vide §7.6) → PDF entregue → outcome contabilizado.
3. Cliente baixa o mesmo PDF 2× em 10s (double-click) → 2 outcomes contabilizados (idempotente, sem side-effect persistido; cada chamada é cobrável em tese mas auditoria via fileSize+latency_ms permite deduplicar).

**Exemplos negativos:**

1. Tenant em SHADOW, análise `status=ready` (gerada mas não revisada) → 422 → **não conta como outcome** (bloqueio mecânico de C4).
2. Análise `status=delivered` com `dreJson=null` (corrompida) → 422 `DRE_NOT_READY` → não conta.
3. `analysisId` válido mas pertence a outro tenant → 404 → não conta (C8; ver §7.4).

### 1.2. `report_exported_investors`

> "Um relatório investors é considerado **exportado** quando o agente retorna um stream `application/pdf` válido contendo: (a) sumário executivo dos 3 cards de narrativa (headline + 1ª linha), (b) bloco de KPIs comerciais sintetizados — `receitaBruta`, `margemLiquida (%)`, `lucroLiquido`, `ebitda` + `margemEbitda (%)`, `totalImpactCents` do plano de ação, contagem de cards por tipo (`critical_gap` / `attention` / `healthy`), soma das ações de horizonte `short` —, gerado a partir de `MonthlyAnalysis` em `status` ∈ {`delivered`, `approved`}."

**Exemplos positivos:**

1. Análise com `lucroLiquido` positivo e 9 actions → PDF com bloco KPIs + ações médio/longo prazo destacadas.
2. Análise com `ebitda` negativo (queima de caixa) → PDF entregue com flag visual vermelha no card EBITDA; outcome conta (relato fiel da situação).
3. Análise sem actions de horizonte `short` → bloco "Ações próximo trimestre" mostra `R$ 0` e count `0`; outcome conta.

**Exemplos negativos:**

1. Análise `status=generating` → 422.
2. `dreJson` presente mas sem campo `ebitda` calculado (drift do pipeline) → renderiza `n/a` em EBITDA mas outcome **conta**; falha é do `dre-narrative`, não do export.
3. `analysisId` inexistente → 404; não conta.

### 1.3. `report_exported_partners`

> "Um relatório partners é considerado **exportado** quando o agente retorna um stream `application/pdf` válido contendo: (a) lucro líquido do mês, (b) distribuição estimada de lucro conforme regras societárias do tenant — **v1 usa proporção igual entre N sócios mockados (default N=2, 50/50)**; v2 lerá de `productConfig.partners[].sharePercentage` (TODO Onda C) —, (c) ações de horizonte `short` (próximo trimestre), gerado a partir de `MonthlyAnalysis` em `status` ∈ {`delivered`, `approved`}."

**Exemplos positivos:**

1. Tenant com 2 sócios (default), `lucroLiquido = R$ 100.000` → PDF mostra `Sócio 1: R$ 50.000 / Sócio 2: R$ 50.000`.
2. Tenant com 4 sócios cadastrados (v2) → distribuição 25/25/25/25 (ou conforme `sharePercentage`).
3. `lucroLiquido` negativo → PDF mostra `Distribuição estimada: R$ 0` + disclaimer "Não há lucro para distribuir neste mês"; outcome conta.

**Exemplos negativos:**

1. Análise `status=ready` (SHADOW) → 422.
2. `productConfig.partners[]` configurado com `sharePercentage` que não soma 100% (v2; v1 ignora) → fallback para distribuição igual + log warning; outcome conta com proviso.
3. Cross-tenant → 404.

---

## 2. Features cobertas

Identificadores das 60 features do Aicfo: **#28** (Export PDF mensal), **#29** (Export PDF investidores), **#30** (Export PDF sócios). Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

---

## 3. Endpoints

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/analysis/:analysisId/export/:type` | Streaming de PDF; `type` ∈ {`monthly`, `investors`, `partners`} |

### 3.1. Request

- **Path params**: `analysisId` (UUID), `type` (enum: `monthly` / `investors` / `partners`)
- **Headers**: `Authorization: Bearer <jwt>` (tenant inferido do token)
- **Body**: nenhum

### 3.2. Response

| Status | Significado | Headers/Body |
|---|---|---|
| `200` | PDF gerado com sucesso | `Content-Type: application/pdf`; `Content-Disposition: attachment; filename="aicfo-{type}-{referenceMonth}.pdf"`; body: stream binário |
| `404` | `analysisId` não existe OU pertence a outro tenant (C8 — não vazar existência) | `{ error: "ANALYSIS_NOT_FOUND" }` |
| `422` | Análise existe mas não está em estado exportável (status non-exportable OU `dreJson` null) | `{ error: "ANALYSIS_NOT_EXPORTABLE", reason: "status=ready" \| "dre_not_ready", currentStatus, exportableStatuses: ["delivered","approved"] }` |
| `500` | Falha de pdfkit (erro de fonte, paginação, etc.) | `{ error: "EXPORT_GENERATION_FAILED" }` |

### 3.3. Excel — fora de escopo Onda 1

A spec original (stub) mencionava "PDF/Excel". **Excel está deferido para v2** — apenas PDF é entregue na Onda 1. O backend nem implementa Excel.

---

## 4. C4 enforcement — status gate mecânico

A spec **declara explicitamente** o status gate como bloqueio mecânico do princípio C4 (SHADOW antes de cobrar):

```ts
// src/persistence/analysis-status.ts (canônico)
export const EXPORTABLE_STATUSES = ["delivered", "approved"] as const;
export const canExport = (status: string) =>
  (EXPORTABLE_STATUSES as readonly string[]).includes(status);
```

A rota `GET /analysis/:id/export/:type` aplica o gate **antes** de invocar `generator.ts`:

```ts
if (!canExport(analysis.status)) {
  return reply.code(422).send({
    error: "ANALYSIS_NOT_EXPORTABLE",
    reason: `status=${analysis.status}`,
    currentStatus: analysis.status,
    exportableStatuses: EXPORTABLE_STATUSES,
  });
}
if (!analysis.dreJson) {
  return reply.code(422).send({ error: "ANALYSIS_NOT_EXPORTABLE", reason: "dre_not_ready" });
}
```

**Implicação operacional** (fix aplicado em commit `2e44531`):

- Tenant em modo **SHADOW** nunca atinge `status=delivered` na entrega ao cliente (review humana é pré-requisito), logo **nunca consegue baixar PDF** — C4 enforced no código, não apenas no contrato.
- Tenants em **ASSISTED** / **AUTONOMOUS** transitam para `delivered` (e eventualmente `approved`) e passam pelo gate normalmente.
- Status `pending`, `generating`, `ready` **sempre** retornam 422 — não há flag para bypass.

---

## 5. Conteúdo por sabor

### 5.1. `monthly` (cliente final)

- Header: nome do tenant (`tenant.name`), mês de referência (`YYYY-MM`)
- DRE Facilitado: 31 linhas (receita bruta → deduções → receita líquida → CMV/CSP → margem bruta → despesas operacionais → EBITDA → resultado financeiro → lucro líquido)
- 3 cards de narrativa: headline + body de cada card (`critical_gap` / `attention` / `healthy`)
- Plano de ação: 3 horizontes (short / medium / long), cada item com título, descrição, impacto estimado, donor sugerido
- Footer: data de geração + paginação (`página X de Y`)
- Fundo do card de lucro líquido: verde (positivo) / vermelho (negativo)

### 5.2. `investors` (board / investidor)

**KPIs explícitos** (gap apontado no review):

| KPI | Fonte | Fórmula |
|---|---|---|
| `receitaBruta` | `dreJson.receitaBruta` | direto |
| `margemLiquida (%)` | derivado | `lucroLiquido / receitaBruta × 100` |
| `lucroLiquido` | `dreJson.lucroLiquido` | direto |
| `ebitda` | `dreJson.ebitda` | direto |
| `margemEbitda (%)` | derivado | `ebitda / receitaBruta × 100` |
| `totalImpactCents` | `actionPlan` | soma de `impactCents` de todas as actions |
| `cardTypeCounts` | `narrativeCards[]` | contagem por `cardType` (`critical_gap`, `attention`, `healthy`) |
| `shortHorizonImpactCents` | `actionPlan` | soma de `impactCents` das ações com `horizon=short` |

Sumário executivo: headline + 1ª linha de cada card.

Conteúdo adicional: ações de horizonte `medium` e `long` (foco em decisões estratégicas, não execução tática).

### 5.3. `partners` (sócios)

**Fórmula de distribuição** (gap apontado):

- **v1 (Onda 1)**: distribuição **igual** entre N sócios. N default = 2 (50/50). Não lê `productConfig.partners[]`. Se `lucroLiquido <= 0`, distribuição = R$ 0 + disclaimer.
- **v2 (Onda C — TODO)**: ler `productConfig.partners[]` com `{ name, sharePercentage, role }`. Validar `Σ sharePercentage === 100`; fallback para distribuição igual + log warning se inválido.
- **Disclaimer literal no PDF** (já presente — confirmar no generator): "Valor estimado bruto; não considera impostos sobre distribuição, reserva legal, ou outros encargos. Consulte seu contador antes de saque."

Conteúdo: lucro líquido, distribuição estimada por sócio, ações de horizonte `short` (próximo trimestre — execução tática que sócios precisam aprovar).

---

## 6. Configuração por tenant (C8)

| Campo | Origem | Usado em | Status |
|---|---|---|---|
| `tenant.name` | `Tenant.name` | Header de todos os 3 sabores | ✅ implementado |
| `tenant.cnpj` | `Tenant.cnpj` | Header (opcional) | ✅ implementado |
| `productConfig.partners[]` | `Tenant.productConfig` (JSONB) | Sabor `partners` (v2) | 🔴 TODO Onda C |
| `productConfig.fiscalRegime` | `Tenant.productConfig` (JSONB) | Disclaimer fiscal no PDF partners | 🔴 TODO Onda C |

**Nada de hardcode por tenant.** Toda configuração lida via `TenantContext` (helper canônico de C5/C8).

---

## 7. Edge cases

### 7.1. `dreJson` null (análise corrompida)

→ 422 explicit (`ANALYSIS_NOT_EXPORTABLE`, `reason: "dre_not_ready"`). Não tenta renderizar PDF parcial.

### 7.2. Double-click do botão de download

→ **Idempotente**: cada chamada gera um PDF byte-idêntico (renderização determinística sobre os mesmos dados). Não há side-effect persistido. Cliente recebe 2 streams equivalentes. Auditoria via logger estruturado (`tenantId`, `analysisId`, `type`, `fileSize`, `latency_ms`) permite deduplicação posterior.

### 7.3. Blob zero-sized

→ **TODO Onda C**: validar `payload.length > MIN_PDF_BYTES` (sugestão: 1024) antes de `reply.send()`. Hoje confia em pdfkit não emitir buffer vazio. Caso ocorra: client recebe `Content-Length: 0` → leitor PDF acusa "arquivo inválido". Risco operacional baixo (pdfkit emite estrutura mínima mesmo com dados vazios).

### 7.4. Cross-tenant `analysisId`

→ **404** (não 403). Conforme implementação atual (`src/export/routes.ts`) e C8: não vazar existência de recurso de outro tenant. O contrato OpenAPI **não documenta 403** para esta rota (apenas 404/422/500); 403 ficaria reservado para futuro role-gating (`viewer` sem permissão de export) com `detail` distinto.

### 7.5. Filename injection via `referenceMonth`

→ **TODO Onda C**: sanitizar `referenceMonth` com regex `^\d{4}-\d{2}$` antes de interpolar em `Content-Disposition`. Hoje confia na factory do `dre-narrative` (que só persiste no formato `YYYY-MM`). Defesa-em-profundidade: rejeitar com 500 antes de interpolar se regex falhar.

### 7.6. Edição do cliente (`clientEditedNarrative` / `clientEditedActionPlan`)

→ **v1 renderiza dados originais** (campos `dreJson` / `narrativeCards` / `actionPlan` originais). Iteração futura pode aceitar `?useClientEdits=true` para exportar versão editada. Decisão deliberada: relatório auditável bate com o que o pipeline gerou; edições do cliente são overlay UI.

### 7.7. Excel

→ **NÃO IMPLEMENTADO**. Spec original mencionava; deferido para v2. Backend não tem rota nem dependência (xlsx, exceljs). Documentado aqui explicitamente para evitar drift.

---

## 8. Eval suite mínima

Localização: `evals/export/cases/*.yml`. **≥30 casos** distribuídos:

| Categoria | Casos | Outcome alvo |
|---|---|---|
| Monthly happy path (status delivered/approved, dre completo) | ≥6 | `report_exported_monthly` |
| Monthly status non-exportable (pending/generating/ready) | ≥4 | 422 |
| Monthly dre null | ≥2 | 422 |
| Monthly cross-tenant | ≥2 | 404 |
| Monthly double-click (2 reqs em <1s, mesma análise) | ≥2 | 2× outcome, bytes idênticos |
| Investors com lucro positivo | ≥3 | `report_exported_investors` |
| Investors com lucro negativo (ebitda < 0) | ≥3 | outcome conta, flag visual |
| Investors sem ações horizonte short | ≥2 | outcome conta, count=0 |
| Partners 1 sócio (v1 default ajustável) | ≥2 | distribuição 100% |
| Partners 2 sócios (50/50) | ≥2 | distribuição igual |
| Partners 4 sócios (25/25/25/25) | ≥2 | distribuição igual |
| Partners lucro negativo | ≥2 | distribuição R$ 0 + disclaimer |

**Assertions** (binárias, sem LLM-as-judge):

- HTTP status code esperado
- `Content-Type === application/pdf`
- `payload.length` entre `[MIN_BYTES_BY_TYPE, MAX_BYTES_BY_TYPE]` (ranges declarados por sabor)
- PDF magic bytes (`%PDF-`) presentes nos primeiros 5 bytes
- `Content-Disposition` filename matches `^aicfo-(monthly|investors|partners)-\d{4}-\d{2}\.pdf$`

Execução: `/novais-digital:eval --module export --model n/a` (sem LLM, eval é puro assert).

---

## 9. Telemetria (C6)

**Sem trace Langfuse** — não há chamada LLM em runtime. Mas como os 3 outcomes são auditáveis e cobráveis, **logger estruturado é obrigatório**:

```ts
logger.info({
  event: "export.report.generated",
  tenantId,
  analysisId,
  type,                    // monthly | investors | partners
  fileSize,                // bytes
  latency_ms,
  outcomeType: `report_exported_${type}`,
  costBrl: 0,
  sku: "monthly-analysis",
}, "PDF exportado");
```

**TODO Onda C — Auditoria de download (LGPD)**:

- Tabela `export_audit { id, tenantId, analysisId, type, userId, ipAddress, userAgent, fileSize, exportedAt }`
- OU campo `lastExportedAt` + contador `exportCount` em `MonthlyAnalysis`
- Necessário para disputas de cobrança e compliance LGPD (direito de auditoria do titular dos dados).

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Vazamento via filename/metadata PDF** | Baixa | Médio | TODO Onda C: sanitizar `referenceMonth` regex `^\d{4}-\d{2}$`; remover metadata `Author`/`Creator` do pdfkit |
| **Performance em análise grande** | Muito baixa | Baixo | 31 linhas DRE + 3 cards + 9 actions = payload pequeno (~100-200KB); não é cenário realístico |
| **Rate limit ausente — flood download** | Média | Médio | TODO Onda C: `@fastify/rate-limit` 60 req/min por tenant em `/analysis/*/export/*` |
| **Auditoria LGPD (quem/quando baixou)** | Alta (regulatório) | Alto | TODO Onda C: tabela `export_audit` (vide §9) |
| **Fórmula partners equivocada (v1 mock)** | Média | Médio (regulatório) | Disclaimer literal no PDF + v2 lê de `productConfig.partners[]` |
| **Status gate bypass** | Mitigado | Crítico (C4) | Fix aplicado em commit `2e44531`; teste `routes.status-gate.spec.ts` cobre |
| **PDF blob zero-sized** | Muito baixa | Baixo | TODO Onda C: validar `payload.length > 1024` antes de send |
| **Cross-tenant vazamento** | Mitigada | Alto (C8) | 404 (não 403) — testes em `routes.multitenancy.spec.ts` cobrem |

---

## 11. Unit economics

**Cost-per-outcome: R$ 0,00.** Renderização determinística com pdfkit. Custo = CPU + memória do worker Node.

- CPU estimado: ~80-150ms wall-time por PDF (paginação + drain)
- Memória: pico ~15MB por geração (pdfkit + buffer)
- Não conta no orçamento C3 (custo de inferência ≤ 25% do preço) — outcome "gratuito" do ponto de vista de LLM

**Implicação para C3**: o SKU `monthly-analysis` é cobrado **uma vez por mês** (1 análise = 1 entrega). Os 3 outcomes de export são "incluídos" no preço da análise — não há cobrança por export separadamente. Múltiplos downloads = mesmo outcome contábil (1 análise entregue).

---

## 12. Implementação

Backend já entregue (commit `8f51c09` + fix `2e44531`):

- `src/export/generator.ts` — pdfkit, 3 sabores, paginação, fundo verde/vermelho
- `src/export/routes.ts` — `GET /analysis/:id/export/:type` + status gate em `EXPORTABLE_STATUSES`
- `src/persistence/analysis-status.ts` — fonte canônica de `EXPORTABLE_STATUSES` e `canExport()` (compartilhada entre route, frontend Zod schema, generator)

**Pendências (Onda C dos fixes)**:

- [ ] Rate limit por tenant
- [ ] Auditoria de download (`export_audit` ou `lastExportedAt`)
- [ ] Sanitização de `referenceMonth` regex
- [ ] Validação `payload.length > MIN_BYTES`
- [ ] Eval suite ≥30 casos em `evals/export/cases/`
- [ ] v2: `productConfig.partners[]` para sabor `partners`
- [ ] Flag `?useClientEdits=true` (iteração futura)

---

## 13. Histórico

| Data | Mudança | Autor |
|---|---|---|
| 2026-05-08 | Stub inicial (módulo planejado) | Foundry pipeline |
| 2026-05-11 | Backend complete (commit `8f51c09`) | Rafael Novaes |
| 2026-05-12 | Fix C4 status gate (commit `2e44531`) | Rafael Novaes |
| 2026-05-12 | Promoção stub → detailed: cláusulas C2 dos 3 outcomes, c4_thresholds, KPIs investors enumerados, fórmula partners ratificada (v1 mock + v2 TODO), edge cases, eval suite, riscos | Spec Agent |
