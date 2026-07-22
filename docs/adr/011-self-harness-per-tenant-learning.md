# ADR-011 — Self-Harness, Aprendizado per-Tenant e Conformidade LGPD

**Status:** aceito
**Data:** 2026-05-26
**Autores:** Rafael Novaes (CEO/decisor), Claude Code (rascunho)
**Linked principles:** C2, C3, C4, C5, C6, C8
**Supersedes:** —
**Linked docs:**
- `.claude/CONSTITUTION.md` (princípios C2-C8)
- `docs/adr/008-langgraph-mvp.md` (coexistência LangGraph/BullMQ — pré-requisito)
- `docs/adr/009-vertex-ai-brasil.md` (provider primário Google Vertex AI)
- `docs/adr/010-openai-fallback-dpa.md` (fallback OpenAI pós-DPA)
- `prisma/schema.prisma` (modelos a serem estendidos)

---

## Contexto

O SKU `monthly-analysis` hoje opera como pipeline gerador "fire-and-foundryt": cada mês uma análise é produzida do zero, sem que os agentes incorporem aprendizado das interações do cliente nos meses anteriores. Sinais de feedback estruturado **já existem no schema** (`LedgerEntry.correctedCategory`, `NarrativeCard.clientApproved`, `ActionPlanItem.clientApproved`), mas **nenhum agente os consome**.

Para que o Aicfo evolua de "gerador de análise mensal" para "CFO digital persistente que aprende com o cliente", precisamos de quatro capabilities que hoje não existem:

1. **Memória per-tenant**: padrões inferidos sobre cada empresa que enriquecem o contexto dos agentes em futuras análises.
2. **Aprendizado global controlado**: padrões que se confirmam entre múltiplos tenants do mesmo segmento podem subir para o prompt base, com proteção contra outliers.
3. **Gate de autonomia mensurável**: agentes só operam sem revisão humana após demonstrarem eficácia estatística.
4. **Conformidade LGPD**: cliente sabe que o sistema aprende, pode editar fatos sobre sua operação, dismissar diagnósticos, e exercer direito ao esquecimento sem comprometer a integridade jurídico-fiscal.

Esta ADR consolida as quatro decisões de produto que orientam a implementação.

## Decisão

### 1. Editabilidade do aprendizado: separação fato vs interpretação

A memória do tenant é tipada por `kind`, com controles diferenciados de acordo com a natureza da informação:

| `kind` | Definição | Cliente edita? | Cliente dismissa? |
|---|---|---|---|
| `fact` | Verdade sobre uma transação ou entidade (ex: "Fornecedor X = aluguel") | **Sim** | n/a |
| `preference` | Configuração de tom/formato preferida pelo cliente | **Sim** | n/a |
| `pattern` | Observação matemática agregada (ex: "Receita concentrada em Cliente Y, 47%") | **Não** | **Sim, com `dismissalReason`** |
| `interpretation` | Diagnóstico financeiro do CFO digital (ex: "Concentração de cliente é risco alto") | **Não** | **Sim, com `dismissalReason`** |

**Dismissão não apaga** o `pattern`/`interpretation`. Registra que o cliente está ciente e considera intencional. O sistema continua monitorando e sinalizando quando algo material muda.

**Rationale:** O Aicfo precisa funcionar como CFO direto, não como espelho. Cliente em negação não pode reescrever o diagnóstico. Mas o cliente sempre tem autoridade sobre **o que uma transação é** (porque ele viveu a transação; o sistema só vê o extrato).

### 2. Proteção contra outliers no aprendizado global

Aprendizado é **per-tenant por padrão**. Um sinal aprendido em um tenant **só sobe para o pool global** quando atender, simultaneamente:

- **Concordância**: pelo menos **5 tenants independentes** convergem para o mesmo sinal
- **Segmentação**: os 5 tenants pertencem ao **mesmo `industrySegment`**
- **Independência**: contas distintas, sem vínculo de grupo econômico

Sinais globais ficam disponíveis para tenants futuros do mesmo segmento como base de partida. Outlier individual (ex: tenant que vende terminais Stone enquanto o resto do segmento usa Stone como adquirência) **não polui o pool**, porque tem seu próprio override per-tenant.

**Decay temporal**: não implementado nesta fase. Mecanismo de revisão por contra-sinal será introduzido se observarmos drift; até lá, simplicidade vence.

**Rationale:** Concordância simples escala honestamente com o tamanho atual da operação (<30 tenants). Clustering comportamental fica como evolução futura quando atingirmos ≥50 tenants em algum segmento.

### 3. Gate de autonomia: 95% estratificado por confiança

Cada agente (`classification`, `narrative-synthesis`, `action-planning`) tem um gate de autonomia independente.

**Sinal de validação** é tristate por interação:

| Agente | Positivo (+) | Negativo (−) | Nulo |
|---|---|---|---|
| `classification` | Cliente abriu e não corrigiu | Cliente corrigiu (`correctedCategory` populado) | Cliente não abriu |
| `narrative-synthesis` | `clientApproved = true` | `clientApproved = false` ou card removido | `clientApproved = null` |
| `action-planning` | `status = done` ou `in_progress >7 dias` | `status = abandoned` | `status = pending` |

**Janela de medição**: últimas **30 validações com sinal** (nulos não contam), por agente, por tenant.

**Cold start**: todo tenant começa em `needs_review` em todos os agentes. Não há promoção automática até 30 amostras serem acumuladas.

**Cálculo do gate (Opção B — estratificada por confiança):**

Aplicável principalmente a `classification` (que emite `classificationConfidence`):
- Faixa **fácil** (`confidence ≥ 0.85`): exige ≥95% de positivos com ≥30 amostras
- Faixa **difícil** (`confidence < 0.85`): exige ≥95% de positivos com ≥30 amostras
- **Ambas as faixas devem atender simultaneamente**

Para `narrative-synthesis` e `action-planning`, que não emitem confiança comparável, a medição é agregada (95% sobre as 30 últimas validações com sinal).

**Auto-rebaixamento**: se em qualquer momento a eficácia cair abaixo de 95% na janela móvel, o agente volta automaticamente para `needs_review`, com alerta. Retorno ao autônomo é automático quando o gate voltar a ser atendido.

**Rationale:** Sem estratificação por confiança, o gate vira teatro estatístico — 80% das classificações são fáceis e atingir 95% nelas não diz nada. A medição precisa exigir competência nos casos difíceis para autorizar autonomia honesta.

### 4. Conformidade LGPD

**Dois regimes distintos:**

| Regime | Origem | Escopo |
|---|---|---|
| Encerramento de conta | Cliente cancela assinatura | Mantém dados para reativação por X meses, depois cascade |
| Direito ao esquecimento (LGPD Art. 18) | Cliente pede expressamente | Apaga tudo, exceto exceções legais |

**Quatro camadas de deleção em pedido de esquecimento:**

1. **Dados operacionais** (`LedgerEntry`, `MonthlyAnalysis`, `NarrativeCard`, `ActionPlanItem`): `ON DELETE CASCADE` na FK de `Tenant` — já configurado.
2. **Memória per-tenant** (`TenantMemoryItem`): cascade junto com `Tenant`.
3. **Traces LangSmith** (PII em prompts e respostas): job síncrono ao cascade dispara API de deleção do LangSmith por `tenantId`; retry + alerta em caso de falha.
4. **Sinal global agregado** (k-anonimidade): índice interno registra contribuintes por sinal global. Na deleção:
   - Sinal mantém ≥5 contribuintes → persiste (estatisticamente anônimo, juridicamente defensável)
   - Sinal cai <5 contribuintes → **removido** do prompt base, volta a ser apenas per-tenant nos restantes até que novos tenants reforcem

**Postura B — Retenção fiscal:**

Mesmo em pedido de esquecimento, **retemos por 5 anos em cold storage** (não acessível pelo produto, apenas por requisição judicial/contábil):
- `LedgerEntry` brutos (lançamentos contábeis)
- `MonthlyAnalysis.dreJson` (DREs gerados)

Base legal: cumprimento de obrigação legal fiscal (LGPD Art. 7, II). Cliente assina termo de ciência no onboarding e no momento do pedido. **Tudo o mais é apagado.**

**Prazos:**
- LGPD: até 15 dias para responder pedido de esquecimento
- Cold storage: 5 anos a partir da data do pedido, depois purga automática

## Implicações em schema

### Novas tabelas

```prisma
model TenantMemoryItem {
  id           String   @id @default(uuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  kind         String   // "fact" | "preference" | "pattern" | "interpretation"
  content      Json     // estrutura tipada por kind
  confidence   Float    // 0.0–1.0
  evidenceRefs Json     // [{ source: "ledger_entry|narrative|action", refId, observedAt }]

  // Editabilidade (kind=fact|preference) ou dismissão (kind=pattern|interpretation)
  clientEdited       Boolean  @default(false)
  dismissedAt        DateTime?
  dismissalReason    String?

  // Aprendizado global: sinal contribuiu para pool global?
  contributesToGlobal Boolean @default(false)
  globalSignalId      String?

  expiresAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([tenantId, kind])
  @@index([globalSignalId])
}

model GlobalSignal {
  id              String   @id @default(uuid())
  segment         String   // industrySegment
  kind            String   // "fact" | "pattern" — preferences/interpretations não viram globais
  content         Json
  contributorCount Int     // calculado a partir das contribuições

  promotedAt      DateTime @default(now())
  retiredAt       DateTime?

  @@index([segment, kind])
}

model ValidationMetric {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  agentName       String   // "classification" | "narrative-synthesis" | "action-planning"
  confidenceBand  String?  // "easy" | "hard" — null para agentes sem estratificação
  signal          String   // "positive" | "negative"
  refType         String   // "ledger_entry" | "narrative_card" | "action_item"
  refId           String

  observedAt      DateTime @default(now())

  @@index([tenantId, agentName, observedAt])
}

model LegalRetention {
  id              String   @id @default(uuid())
  originalTenantId String   // ID do tenant deletado (sem FK — tenant não existe mais)
  cnpj            String?

  retainedData    Json     // { ledgerEntries: [...], dreSnapshots: [...] }
  retentionUntil  DateTime // 5 anos após o pedido

  forgottenAt     DateTime @default(now())
  termAcceptedHash String  // SHA-256 do termo assinado pelo cliente

  @@index([retentionUntil])
}
```

### Modificações em tabelas existentes

- `ActionPlanItem`: adicionar `status` (`pending | in_progress | blocked | done | abandoned`), `statusReason`, `lastStatusUpdateAt` — pré-requisito para sinal de validação do `action-planning`
- `NarrativeCard`: já tem `clientApproved` e `clientComment` — nenhuma mudança necessária
- `Tenant`: adicionar `learningAutonomyState` (`Json` — { classification: "needs_review", narrative: "needs_review", action: "needs_review" } por padrão)

## Implicações em código

### Novos módulos

- `src/learning/self-harness-worker.ts`: BullMQ worker que escuta eventos de interação e atualiza `TenantMemoryItem` + `ValidationMetric`
- `src/learning/tenant-context.ts`: monta o contexto L1 dos agentes a partir de `TenantMemoryItem` + `GlobalSignal` do segmento
- `src/learning/autonomy-gate.ts`: avalia se um agente atingiu critério para promoção/rebaixamento autônomo
- `src/learning/eval-continuous.ts`: roda eval sobre amostras reais para detectar drift

### Modificações em agentes LangGraph

Todos os nós de agente passam a:
1. Receber `tenantContext` (L1) montado por `tenant-context.ts`
2. Reportar a saída para `self-harness-worker` via fila

### Novas rotas API

- `GET /tenant/memory` — cliente lista o que foi aprendido sobre sua empresa
- `PATCH /tenant/memory/{id}` — cliente edita um `fact` ou `preference`
- `DELETE /tenant/memory/{id}` — cliente apaga um item
- `POST /tenant/memory/{id}/dismiss` — cliente dismissa um `pattern`/`interpretation` com motivo
- `PATCH /actions/{id}/status` — cliente atualiza status de ação
- `POST /tenant/lgpd-erasure-request` — dispara fluxo de esquecimento

## Implicações em infraestrutura

### Ambiente staging dedicado (pré-requisito)

Esta ADR introduz mudanças de comportamento que **não podem ser validadas em produção sem risco para os tenants ativos**: aprendizado per-tenant escrevendo em contexto L1, gates de 95% promovendo/rebaixando agentes automaticamente, deleções LGPD com k-anonimidade global. Antes de iniciar a Etapa 1 do roadmap, precisamos de um ambiente staging completo e isolado:

- **Banco de dados separado** (instância Postgres dedicada — não schema compartilhado): permite migrations destrutivas, seed de tenants sintéticos e `prisma migrate reset` sem afetar dados de cliente
- **Workers e filas isolados** (Redis/BullMQ dedicado): self-harness escrevendo em staging não pode disparar trabalhos em produção
- **Projeto Vertex AI Brasil separado** (ou ao menos service account distinta com quota independente): evita que loops de eval contínuo em staging consumam quota de produção e poluam métricas de custo do C3
- **Projeto LangSmith separado** (ou tag `env=staging` consistente): traces de experimentação não devem misturar com traces auditáveis dos tenants reais
- **Branch deploy convention**: PRs e branches `feat/aicfo-*` deployam automaticamente em staging; merge em `main` só após validação manual em staging + eval suite verde
- **Tenants sintéticos representativos**: ≥3 tenants gerados a partir de dados anonimizados de clientes reais (com consentimento) para que gates de 95% e concordância de 5-tenants tenham material realista de teste

**Custo estimado**: instância Postgres pequena (~R$ 50/mês) + Redis dedicado (~R$ 30/mês) + quota Vertex/LangSmith adicional (~R$ 30/mês no volume de eval). Total ~R$ 110/mês — barato comparado ao risco de degradar análise de cliente pagante.

**Decisão de plataforma de staging**: a definir em ADR separada antes da Etapa 1 (opções: Railway environment paralelo, GCP Cloud Run staging, ou nova instância no provedor atual). Não-bloqueante para esta ADR, mas bloqueante para Etapa 1.

## Roadmap de implementação

| Etapa | Escopo | Duração | Pré-requisito |
|---|---|---|---|
| 0 | Atualizar CLAUDE.md/Constituição para refletir LangSmith (não Langfuse) | <1 dia | — |
| 0.5 | **Ambiente staging dedicado** (Postgres + Redis + Vertex + LangSmith isolados; convenção de deploy por branch; seed de tenants sintéticos) | ~1 semana | ADR de plataforma de staging assinada |
| 1 | Promover LangGraph para default (substitui BullMQ legacy no `monthly-analysis`) | 4-6 semanas calendário | ADR-008 cumprida em SHADOW; **Etapa 0.5 concluída** |
| 2 | Lifecycle de Action Plan (`status` + histórico) — gera sinal de validação do `action-planning` | ~2 semanas | Etapa 1 |
| 3 | Tabela `TenantMemoryItem` + retrievers de feedback + injeção no contexto L1 dos agentes | ~2 semanas | Etapa 1 |
| 4 | `SelfHarnessWorker` MVP — primeiro loop fechado (classificação corrigida → contexto atualizado) | ~3 semanas | Etapa 3 |
| 5 | `ValidationMetric` + `AutonomyGate` (gates de 95%) + auto-rebaixamento | ~2 semanas | Etapa 4 |
| 6 | `GlobalSignal` + concordância intra-segmento + k-anonimidade na deleção | ~3 semanas | Etapa 5 |
| 7 | `EvalContinuous` + bandit de prompts (PromptMemory) | ~3 semanas | Etapa 5 |
| 8 | UI de transparência (frontend — demanda dev frontend): tela "O que o Aicfo aprendeu sobre você" + edição/dismissão | ~2 semanas | Etapa 4 |

**Total: ~22 semanas de calendário** para o pacote completo. Cada etapa entrega valor isolado — não é big bang.

## Consequências

### Positivas

- Aicfo deixa de ser amnésico mensal e vira CFO persistente
- Diferencial de marketing concreto: "seu CFO digital aprende sua empresa"
- Schema já carrega 80% das matérias-primas (campos de feedback existem desde Onda 1)
- Aprendizado global cria efeito de rede: novos tenants chegam pré-calibrados pelo segmento
- Gate de 95% estratificado oferece base juridicamente defensável para evolução de SHADOW → ASSISTED → AUTONOMOUS (C4)

### Negativas

- ~22 semanas de calendário com features incrementais; produto demora a "chegar ao estado final"
- Custo de inferência sobe: agentes leem mais contexto, escrevem mais sinais
- Risco de drift se eval contínuo falhar — sistema pode "aprender errado" e degradar análises
- Complexidade operacional aumenta: monitorar 3 gates por tenant, auto-rebaixamentos, deleções LGPD com k-anonimidade
- Custo de armazenamento sobe: cold storage de retenção fiscal por 5 anos não é grátis

### Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Memória aprendida fica errada e contamina análises | `EvalContinuous` detecta drift; auto-rebaixamento bloqueia propagação |
| Cliente outlier sabota pool global | Concordância de 5 tenants independentes; sinal só sobe quando há consenso |
| Pedido LGPD compromete sinal global de outros tenants | K-anonimidade k=5 mantém defensabilidade jurídica |
| Custo de inferência quebra C3 (≤25%) | Modelo Gemini Flash como default via Vertex AI (ADR-009); upgrade para Gemini Pro só em casos complexos; OpenAI gpt-4.1-mini como fallback (ADR-010); tiering por plano |
| Schema explode com novos modelos sem uso real | Etapas 0-2 não criam `TenantMemoryItem` — só Etapa 3; gate de aprovação humana antes de Etapa 6 |

## Conformidade com a Constituição

- **C2 (outcome-first)**: aprendizado não muda o outcome contratual (análise mensal entregue); apenas melhora a precisão da entrega ao longo do tempo
- **C3 (custo ≤25%)**: cada etapa exige recalc de unit economics antes de ligar — gate explícito antes da Etapa 4
- **C4 (SHADOW antes de cobrar)**: gate de 95% estratificado **É** o mecanismo de C4 aplicado a self-harness; auto-rebaixamento garante reversibilidade
- **C5 (three-tier context)**: `TenantMemoryItem` é estritamente L1; `GlobalSignal` é parte do L0 enriquecido do segmento; análise corrente é L2
- **C6 (telemetry-by-default)**: toda interação self-harness gera trace LangSmith com tenantId redacted onde aplicável
- **C8 (anti-customização heroica)**: aprendizado per-tenant é **dado** (`TenantMemoryItem`), não código; nenhum `if (tenantId === 'X')` em parte alguma; `tenant-context-curator` Guardian valida em cada PR
