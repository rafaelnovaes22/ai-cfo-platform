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
  - analysis_delivered_whatsapp
related_adrs: ["014", "015", "016"]
provider: "unnichat"
created_at: "2026-05-29"
last_updated: "2026-05-29"
version: "0.1.0"
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

---

## 2. Endpoints expostos

| Endpoint | Descrição |
|---|---|
| `POST /webhooks/whatsapp` | Recebe eventos Unnichat (mensagens + status) |
| `GET /webhooks/whatsapp` | Verificação de webhook (Unnichat handshake) |

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
| `student` (free) | Resumo diário + comando "caixa" + "semana" |
| `lite` | Tudo do student + análise mensal + ingest de arquivos |
| `pro` / `business` | Tudo do lite + múltiplas empresas |

---

## 6. Configuração por tenant (C8)

```ts
Tenant.config.whatsapp = {
  phone: string,           // número vinculado (E.164)
  notificationTime: "08:00", // hora do resumo diário
  notificationsEnabled: true,
  language: "pt-BR",
}
```

---

## 7. Edge cases

| # | Caso | Comportamento |
|---|---|---|
| EC1 | Número não vinculado a tenant | Envia magic link de auth |
| EC2 | Token expirado mid-session | Pede nova autenticação |
| EC3 | Arquivo corrompido no ingest | Mensagem de erro amigável + lista formatos aceitos |
| EC4 | Unnichat retorna erro 5xx | Retry com backoff; falha silenciosa após 3 tentativas |
| EC5 | Plano `student` tenta ingest | Responde "funcionalidade disponível no plano Lite" |
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
