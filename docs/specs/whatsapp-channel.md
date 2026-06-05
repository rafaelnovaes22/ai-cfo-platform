---
module_key: "whatsapp-channel"
module_name: "WhatsApp Channel — Canal de Entrega Principal"
wave: 2
tier: "B"
status: "detailed"
ai_enabled: false
criticality: "critical"
constitution_version: "0.3.0"
features_covered: "#whatsapp-delivery, #daily-notification, #student-free-tier"
c4_thresholds:
  agreement_rate: 1.00
  latency_p95_ms: 3000
  cost_per_outcome_brl: 0.10
  min_run_count: 10
  min_window_days: 5
outcomes:
  - message_delivered
  - cashflow_summary_sent
  - cashflow_from_statement
  - analysis_delivered_whatsapp
related_adrs: ["014", "015", "016", "017"]
provider: "unnichat"
created_at: "2026-05-29"
last_updated: "2026-06-05"
version: "0.3.0"
---

# WhatsApp Channel — Canal de Entrega Principal

> WhatsApp é o **outcome principal** do Aicfo. Clientes (especialmente estudantes no free tier)
> recebem resumo diário de caixa e análise mensal via WhatsApp através da plataforma Unnichat (BSP parceiro).
> Módulo de canal — sem LLM próprio; consome endpoints existentes (`/cashflow/summary`, pipeline `monthly-analysis`).

---

## 1. Cláusula contratual de outcome (C2)

### 1.1. `message_delivered`
> Uma mensagem do Aicfo é considerada **entregue** quando o Unnichat confirma recepção
> com status `delivered` ou `read` para o número de telefone do tenant autenticado,
> em menos de 3 segundos da chamada à API Unnichat.

### 1.2. `cashflow_summary_sent`
> O resumo diário de caixa é considerado **enviado** quando, dado o comando "caixa" ou "hoje"
> no WhatsApp, o sistema retorna mensagem formatada com saldo, entradas e saídas do dia,
> derivados de `GET /cashflow/summary`, em menos de 3 segundos.

### 1.3. `analysis_delivered_whatsapp`
> A análise mensal é considerada **entregue via WhatsApp** quando o tenant recebe
> mensagem de texto com resumo executivo (DRE top-5 + card crítico) e documento PDF
> via `sendDocument` Unnichat, confirmado com status `delivered`.

### 1.4. `cashflow_from_statement`
> Quando o aluno (plano `student`) envia um extrato (Excel/CSV/PDF) pelo WhatsApp,
> o fluxo de caixa do **período exato do arquivo** (entradas, saídas e resultado) é
> retornado **automaticamente** — sem necessidade de comando e **sem LLM** (pura
> agregação determinística, custo de inferência R$ 0). A classificação em contas do
> DRE permanece exclusiva dos planos pagos (`cashflow_from_statement` ≠ análise).

---

## 2. Endpoints expostos

| Endpoint | Descrição |
|---|---|
| `POST /webhooks/whatsapp` | Recebe eventos Unnichat (mensagens + status) |
| `GET /webhooks/whatsapp` | Verificação de webhook (Unnichat handshake) |
| `GET /config/whatsapp` | Lê config do canal para o tenant (`phone`, `enabled`, `optInAt`) |
| `PATCH /config/whatsapp` | Atualiza destinatário e/ou liga/desliga envio (admin) — carimba opt-in LGPD |
| `GET /whatsapp/messages` | **(planejado — ADR-017)** Lista mensagens enviadas/suprimidas do tenant (admin) |

### 2.1. Configuração do canal (`/config/whatsapp`)

Não há "frequência" configurável — o envio proativo é fixo (cron diário). O que o tenant
controla é **o número destinatário** e o **liga/desliga** do envio:

- `GET /config/whatsapp` → `{ phone: string | null, enabled: boolean, optInAt: string | null }`.
  `phone` pode vir pré-preenchido pelo `/register` (campo `phone` opcional, E.164) ou `null` se
  não informado no cadastro. Em ambos os casos o canal nasce **desabilitado** (sem opt-in).
- `PATCH /config/whatsapp` body `{ phone?: string (E.164) | null, enabled?: boolean }`, role `admin`.
  - Habilitar (`enabled: true`) sem `phone` configurado nem informado → **400**.
  - Habilitar carimba `whatsappOptInAt = now()` (opt-in explícito, LGPD Art. 7 — ver ADR-016).
  - Desabilitar preserva o `optInAt` histórico.

### 2.2. Listagem de mensagens (`GET /whatsapp/messages`) — planejado

Persistência de mensagens não existe na v0.2.0 (ver §8). A listagem para o operador — incluindo
mensagens **suprimidas** por opt-out (`skipped_disabled`) — depende do model `WhatsappMessage`
e da política de retenção definidos na **[ADR-017](../adr/017-whatsapp-message-log-retention.md)**.
O contrato OpenAPI/Zod já é publicado para o front integrar contra mock; o backend é item próprio.

---

## 3. Arquitetura do módulo

```
src/channels/whatsapp/
├── types.ts              — interfaces internas (WaMessage, WaSession, WaEvent)
├── schema.ts             — Zod: payload Unnichat webhook + query params
├── adapter.ts            — sendMessage, sendDocument, downloadMedia (Unnichat API)
├── session-manager.ts    — Redis TTL 30min: estado conversacional por número
├── message-parser.ts     — classifica tipo de mensagem (texto, documento, imagem, command)
├── response-formatter.ts — formata cashflow summary / DRE / action-plan para WA markdown
├── conversation-flow.ts  — state machine: IDLE→ONBOARDING→AUTH→MENU→CASHFLOW/ANALYSIS
├── ingest-handler.ts     — download mídia Unnichat → repassa para src/ingest/ existente
├── notification-service.ts — envio proativo: resumo diário 08h00 + análise pronta
└── webhook.ts            — Fastify route: POST + GET /webhooks/whatsapp
```

---

## 4. State machine

```
IDLE
 └─ qualquer msg → ONBOARDING
      └─ tenant vinculado? → AUTH → MENU
           ├─ "caixa" / "hoje"     → CASHFLOW_QUERY → responde + volta MENU
           ├─ "semana"             → CASHFLOW_WEEK  → responde + volta MENU
           ├─ "análise"            → ANALYSIS_CHECK → responde + volta MENU
           ├─ "ajuda" / "menu"     → mostra opções + volta MENU
           └─ arquivo recebido     → INGEST_FLOW → enfileira job + volta MENU
      └─ não vinculado → envia magic link → aguarda AUTH
```

---

## 5. Planos suportados

| Plano | Features via WhatsApp |
|---|---|
| `student` (free) | Comando "caixa" + "semana" + **envio de extrato → fluxo de caixa automático do período do arquivo** (sem LLM). Sem análise DRE. |
| `lite` | Tudo do student + análise mensal (DRE + classificação por LLM) |
| `pro` / `business` | Tudo do lite + múltiplas empresas |

> **Nota de custo (C3):** o fluxo de caixa do `student` é determinístico — parsing + agregação,
> zero inferência. A IA (classificação DRE) só roda nos planos pagos. Ver `docs/onda-0/unit_economics.md`.

---

## 6. Configuração por tenant (C8)

Estado do canal vive em **colunas dedicadas do `Tenant`** (não em `productConfig`):

```prisma
Tenant.whatsappPhone    String?    // número destinatário (E.164)
Tenant.whatsappEnabled  Boolean    // liga/desliga envio proativo
Tenant.whatsappOptInAt  DateTime?  // timestamp do opt-in explícito (LGPD Art. 7)
```

> **Nota:** a versão 0.1.0 desta spec previa `Tenant.config.whatsapp.notificationTime`
> (horário por tenant). Isso **não foi implementado** — o envio é um cron fixo, sem
> frequência configurável. Os campos reais expostos via `/config/whatsapp` são apenas
> `phone` e `enabled` (+ `optInAt` derivado).

---

## 7. Edge cases

| # | Caso | Comportamento |
|---|---|---|
| EC1 | Número não vinculado a tenant | Envia magic link de auth |
| EC2 | Token expirado mid-session | Pede nova autenticação |
| EC3 | Arquivo corrompido no ingest | Mensagem de erro amigável + lista formatos aceitos |
| EC4 | Unnichat retorna erro 5xx | Retry com backoff; falha silenciosa após 3 tentativas |
| EC5 | Plano `student` envia extrato | Permitido: parse+store (sem LLM) e retorna o fluxo de caixa do período do arquivo. A **análise DRE** (classificação por LLM) é que fica restrita aos planos pagos. |
| EC7 | Extrato cruza vários meses | Ingere todos os lançamentos (`keepAllEntries`); o período exibido é o range real (min/max das datas), não um mês fixo. |
| EC8 | Arquivo sem lançamentos válidos | Responde mensagem amigável do ingest ("Nenhum lançamento encontrado…") em vez de silêncio. |
| EC6 | Sessão Redis expirada (TTL 30min) | Recria sessão a partir do próximo webhook |

---

## 8. Telemetria (C6)

- Pino log em cada evento webhook recebido
- Pino log em cada mensagem enviada (com status Unnichat)
- Sem LangSmith (módulo sem LLM)

---

## 9. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-29 | Spec inicial — WhatsApp como outcome principal; Unnichat como BSP; free tier estudantes |
| 0.2.0 | 2026-06-01 | `student` envia extrato e recebe fluxo de caixa automático do período exato do arquivo (zero LLM). EC5 invertido (ingest liberado para `student`); EC7/EC8 adicionados; outcome `cashflow_from_statement`. |
| 0.3.0 | 2026-06-05 | Endpoints de config `GET/PATCH /config/whatsapp` (phone + enabled + opt-in LGPD). Esclarecido: não há "frequência"/`notificationTime` implementado; estado vive em colunas dedicadas do `Tenant`. `GET /whatsapp/messages` planejado via ADR-017 (log de mensagens + retenção). |
