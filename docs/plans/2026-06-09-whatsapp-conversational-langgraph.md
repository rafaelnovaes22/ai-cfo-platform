# WhatsApp Conversational LangGraph Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fazer a conversa do Aicfo no WhatsApp fluir conforme a interação do cliente, preservando estado com LangGraph e usando SLM apenas quando a resposta determinística não for suficiente.

**Architecture:** O webhook continua fazendo ACK rápido, dedup e autenticação do telefone antes de qualquer IA. Usuários autenticados entram em um grafo conversacional LangGraph com estado persistido em Redis via `IWhatsAppSessionStore`; o grafo roteia primeiro por regras zero-token e só chama o SLM para intent ambígua, follow-up aberto, reformulação contextual ou resposta consultiva curta. Conversas ativas são user-initiated; conversas passivas são notificações/proativas com contexto resumido e handoff para o mesmo grafo quando o usuário responde.

**Tech Stack:** Node.js 20, TypeScript ESM, Fastify, `@langchain/langgraph`, Redis session store, Prisma/PostgreSQL, SLM via `src/llm/` router, LangSmith para tracing LLM, WireLog/message log para eventos de negócio, Vitest.

---

## 1. Diagnóstico e decisões de produto

### Problema atual

O fluxo atual do WhatsApp é uma máquina de estados simples com fallback para menu. Isso quebra a expectativa da CEO/cliente porque:

- texto livre desconhecido retorna `formatWelcomeMenu`;
- o estado só sabe `IDLE`, `AWAITING_AUTH`, `MENU`, `CASHFLOW_QUERY`, `INGEST_FLOW`;
- não há memória explícita de última resposta, último relatório, pendência ou expectativa do usuário;
- `1`, `2`, `3` ainda comandam ações para planos não-`student`;
- a conversa parece passiva/menu-driven, não CFO-IA conversacional;
- o código zero-token existe, mas não está modelado como grafo com transições auditáveis.

### Outcome esperado

O WhatsApp deve entregar uma experiência em que o usuário sente que o Aicfo “continua a conversa”, sem gastar tokens em casos previsíveis.

Exemplos positivos:

1. Usuário não vinculado manda qualquer texto → recebe link de vínculo e nada mais.
2. Usuário vinculado manda “quero saber meu fluxo de caixa” → Aicfo pede extrato ou, se já houver dados recentes, oferece leitura contextual.
3. Usuário manda extrato → Aicfo confirma recebimento, processa, devolve caixa do período e pergunta próximo passo útil.
4. Usuário pergunta “vc não continua?” depois de um resultado → Aicfo usa `lastOutcome` e responde com continuação, não menu.
5. Usuário pergunta “isso está bom?” → Aicfo usa SLM com resumo curto do último resultado e responde consultivamente.
6. Aicfo envia notificação passiva “análise pronta” → se usuário responde, o grafo sabe que a mensagem veio de `passive_context=analysis_ready`.

Exemplos negativos:

1. Usuário autenticado recebe menu numerado genérico como fallback.
2. Caixa zerado é apresentado como se fosse uma resposta suficiente quando faltam dados.
3. SLM é chamado para `oi`, `1`, documento, link de auth ou intents triviais.
4. Histórico completo de WhatsApp é enviado ao modelo.
5. Estado de conversa só fica em memória local/processo.
6. Notificação passiva não deixa contexto para a resposta seguinte.

---

## 2. Modelo de consumo: sem tokens vs com tokens

### 2.1 Caminho sem consumo de tokens — default

Usar sempre que a intenção for determinística ou operacional.

Casos:

- auth/link de vinculação;
- saudação inicial;
- usuário envia documento suportado;
- usuário pede explicitamente caixa, extrato, status, ajuda;
- usuário manda `1`, `2`, `3` por compatibilidade;
- usuário pergunta “como envio?”, “qual formato?”, “não tenho extrato”; 
- recuperação de fluxo após timeout;
- confirmação de ingest;
- entrega de métricas financeiras já calculadas;
- fallback contextual simples baseado em `lastOutcome`.

Resposta deve vir de templates em `response-formatter.ts` ou novo `conversation-responses.ts`.

### 2.2 Caminho com consumo de tokens — SLM controlado

Usar apenas quando regras não resolverem com confiança suficiente.

Casos:

- intenção ambígua: “e agora?”, “isso tá bom?”, “o que você acha?”;
- follow-up sobre último resultado financeiro;
- explicação curta em linguagem natural;
- classificação de intenção quando regex/keyword falham;
- resposta consultiva compacta depois de ingest/caixa/análise.

Restrições:

- usar SLM pequeno/baixo custo no router, por exemplo novo task `whatsapp-conversation` com `gemini-2.5-flash-lite` ou SLM local se disponível;
- `max output` curto, alvo 500–900 caracteres;
- input deve conter apenas: mensagem atual, `conversationSummary`, `lastOutcome`, plano, estágio e 2–4 fatos relevantes;
- nunca enviar histórico bruto completo;
- trace obrigatório em LangSmith com `tenantId`, `phoneHash`, `conversationMode`, `intent`, `tokens`, `costCents`, `latencyMs`;
- fallback determinístico se SLM falhar.

### 2.3 Política de orçamento

Adicionar budget por conversa/dia:

- `dailySlmCallCount` por telefone/tenant;
- `dailySlmCostCents`;
- limite inicial sugerido: até 10 chamadas SLM/dia por conversa no PILOT, ajustável por plano;
- quando exceder: responder com templates determinísticos e orientar ação concreta.

---

## 3. Conversa ativa vs passiva

### 3.1 Conversa ativa — usuário inicia

Entrada: webhook `messages[]` do WhatsApp.

Fluxo:

1. verificar assinatura/dedup;
2. resolver sessão;
3. gate de auth sem tokens;
4. carregar/atualizar `ConversationState`;
5. LangGraph classifica intenção;
6. regra determinística tenta resolver;
7. SLM entra só se necessário;
8. envia resposta;
9. persiste estado resumido.

Estados ativos propostos:

- `AWAITING_AUTH`
- `READY_FOR_INPUT`
- `AWAITING_STATEMENT`
- `INGESTING_STATEMENT`
- `SHOWING_CASHFLOW`
- `EXPLAINING_RESULT`
- `AWAITING_CLARIFICATION`
- `ESCALATION_OR_SUPPORT`

### 3.2 Conversa passiva — Aicfo inicia

Entrada: job/notificação/evento de negócio.

Exemplos:

- análise mensal pronta;
- ingest concluído;
- caixa do extrato calculado;
- alerta de risco;
- lembrete para enviar extrato;
- resumo diário/semanal quando permitido.

Regras:

- notificação passiva deve criar/atualizar `passiveContext` na sessão;
- mensagem deve ser curta, com call-to-action claro;
- se o usuário responder dentro da janela da sessão, o grafo interpreta a resposta usando `passiveContext`;
- se responder fora da janela, cai em `READY_FOR_INPUT` com resumo mínimo.

Exemplo:

```txt
📊 Seu fluxo de caixa do extrato ficou pronto.
Entradas: R$ X
Saídas: R$ Y
Resultado: R$ Z

Quer que eu explique o resultado ou gere próximos passos?
```

Se usuário responde “explica”, intent = `EXPLAIN_LAST_OUTCOME`, com SLM permitido.

---

## 4. Estado conversacional proposto

Criar um estado explícito, serializável e pequeno:

```ts
export type WaConversationStage =
  | "AWAITING_AUTH"
  | "READY_FOR_INPUT"
  | "AWAITING_STATEMENT"
  | "INGESTING_STATEMENT"
  | "SHOWING_CASHFLOW"
  | "EXPLAINING_RESULT"
  | "AWAITING_CLARIFICATION"
  | "ESCALATION_OR_SUPPORT";

export type WaConversationMode = "active" | "passive";

export interface WaConversationState {
  phoneE164: string;
  tenantId: string | null;
  userName?: string;
  plan?: string;
  stage: WaConversationStage;
  mode: WaConversationMode;
  lastIntent?: WaIntent;
  lastUserMessage?: string;
  lastBotAction?: string;
  lastOutcome?: {
    type: "cashflow_today" | "cashflow_statement" | "weekly_summary" | "analysis_ready" | "auth_link" | "ingest_received";
    summary: string;
    dataRef?: string;
    createdAt: string;
  };
  pendingAction?: "send_statement" | "wait_ingest" | "choose_next_step" | "link_account";
  passiveContext?: {
    source: "analysis_ready" | "ingest_done" | "cashflow_alert" | "reminder";
    summary: string;
    createdAt: string;
    expiresAt: string;
  };
  conversationSummary?: string;
  slmUsage?: {
    date: string;
    callCount: number;
    costCents: number;
  };
  updatedAt: string;
}
```

Compatibilidade:

- manter `WaSession` por enquanto;
- usar `WaSession.context.conversation` para armazenar o novo estado sem migração imediata;
- depois, se necessário, promover para tabela própria.

---

## 5. Intents propostas

```ts
export type WaIntent =
  | "GREETING"
  | "ASK_CASHFLOW"
  | "SEND_STATEMENT_HELP"
  | "DOCUMENT_RECEIVED"
  | "EXPLAIN_LAST_OUTCOME"
  | "ASK_NEXT_STEP"
  | "ASK_STATUS"
  | "ASK_MONTHLY_ANALYSIS"
  | "AUTH_HELP"
  | "CONFIRMATION"
  | "NEGATION"
  | "HUMAN_SUPPORT"
  | "UNKNOWN";
```

Classificação em camadas:

1. documento → `DOCUMENT_RECEIVED`;
2. número legado `1/2/3` → intent compatível;
3. regex/keywords normalizadas → intent;
4. heurística por estado (`lastOutcome`, `pendingAction`, `passiveContext`);
5. SLM intent classifier se ambíguo;
6. fallback contextual.

---

## 6. LangGraph proposto

Criar novo módulo:

```txt
src/channels/whatsapp/conversation-graph/
├── index.ts
├── state.ts
├── intents.ts
├── guards.ts
├── nodes/
│   ├── auth-gate.ts
│   ├── classify-intent.ts
│   ├── deterministic-router.ts
│   ├── handle-document.ts
│   ├── handle-cashflow.ts
│   ├── handle-followup.ts
│   ├── slm-response.ts
│   ├── passive-context.ts
│   ├── persist-state.ts
│   └── send-response.ts
└── prompts/
    ├── intent-classifier.ts
    └── concise-cfo-reply.ts
```

Grafo lógico:

```txt
START
  → authGate
  → loadConversationState
  → classifyIntent
  → deterministicRouter
      ├─ AUTH_LINK_RESPONSE        → sendResponse → persistState → END
      ├─ DOCUMENT_FLOW             → handleDocument → sendResponse → persistState → END
      ├─ CASHFLOW_DETERMINISTIC    → handleCashflow → sendResponse → persistState → END
      ├─ FOLLOWUP_DETERMINISTIC    → handleFollowup → sendResponse → persistState → END
      ├─ NEED_SLM                  → slmResponse → sendResponse → persistState → END
      └─ FALLBACK_CONTEXTUAL       → sendResponse → persistState → END
```

Importante: LangGraph aqui é usado como orquestrador de estado e transições; ele não implica chamar LLM.

---

## 7. Comportamentos de resposta esperados

### 7.1 Primeiro contato não autenticado — zero token

```txt
Olá! 👋 Para usar o Aicfo pelo WhatsApp, vincule seu número à sua conta:

🔗 {link}

_O link expira em 1 hora._
```

### 7.2 Primeiro contato autenticado — zero token

```txt
Olá, {primeiroNome}! 👋
Sou o Aicfo, seu CFO-IA.

Para começar, me envie um extrato da conta em PDF, Excel ou CSV. Eu calculo seu fluxo de caixa do período e te explico o resultado.

Se preferir, pode me perguntar algo como:
• “como está meu caixa?”
• “quero entender meu resultado”
• “como envio o extrato?”
```

### 7.3 Usuário pede fluxo de caixa sem dados recentes — zero token

```txt
Consigo te ajudar com o fluxo de caixa.

Para calcular com dados reais, me envie um extrato da conta em PDF, Excel ou CSV. Assim eu leio entradas, saídas e resultado do período automaticamente.
```

### 7.4 Usuário pergunta “vc não continua?” após resposta — zero token se houver `pendingAction`

```txt
Continuo sim. O próximo passo é você me enviar um extrato da conta por aqui.
Com ele eu calculo o fluxo de caixa real e te devolvo entradas, saídas e resultado do período.
```

### 7.5 Usuário pergunta “isso está bom?” após resultado — com SLM

Input ao SLM:

```json
{
  "message": "isso está bom?",
  "lastOutcome": "Fluxo de caixa do extrato: entradas R$ X, saídas R$ Y, resultado R$ Z",
  "tenantPlan": "student|lite|pro|business",
  "stage": "SHOWING_CASHFLOW"
}
```

Resposta alvo:

```txt
Está positivo, mas eu olharia dois pontos: concentração das entradas e peso das saídas no período. Se esse resultado veio de poucos recebimentos grandes, pode haver risco de caixa nos próximos dias.

Quer que eu monte 3 próximos passos práticos?
```

---

## 8. Tarefas de implementação

### Task 1: Criar tipos de conversa e intents

**Objective:** Definir contrato serializável do novo estado conversacional.

**Files:**
- Create: `src/channels/whatsapp/conversation-graph/state.ts`
- Create: `src/channels/whatsapp/conversation-graph/intents.ts`
- Modify: `src/channels/whatsapp/types.ts`
- Test: `tests/channels/whatsapp/conversation-state.test.ts`

**Steps:**
1. Criar `WaConversationState`, `WaConversationStage`, `WaConversationMode`, `WaIntent`.
2. Criar helper `initialConversationState(session, tenant?)`.
3. Criar helper `getConversationState(session)` com fallback para sessão legada.
4. Testar que sessão antiga sem `context.conversation` é convertida corretamente.
5. Testar serialização JSON.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/conversation-state.test.ts
```

---

### Task 2: Criar respostas determinísticas sem menu numerado

**Objective:** Substituir fallback/menu por respostas conversacionais orientadas a próximo passo.

**Files:**
- Create: `src/channels/whatsapp/conversation-graph/responses.ts`
- Modify: `src/channels/whatsapp/response-formatter.ts`
- Test: `tests/channels/whatsapp/conversation-responses.test.ts`

**Steps:**
1. Criar `formatConversationalWelcome`.
2. Criar `formatStatementRequest`.
3. Criar `formatContinuePrompt`.
4. Criar `formatLegacyMenuChoiceHint` para `1`, `2`, `3`.
5. Testar que nenhuma resposta nova contém `1️⃣`, `2️⃣`, `3️⃣` ou “Responda com o número”.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/conversation-responses.test.ts tests/channels/whatsapp/response-formatter.test.ts
```

---

### Task 3: Criar classificador determinístico de intents

**Objective:** Cobrir intents comuns sem SLM.

**Files:**
- Create: `src/channels/whatsapp/conversation-graph/intent-classifier.ts`
- Modify: `src/channels/whatsapp/message-parser.ts` apenas se necessário para compartilhar normalização
- Test: `tests/channels/whatsapp/intent-classifier.test.ts`

**Steps:**
1. Implementar normalização lowercase + sem acentos.
2. Mapear documento para `DOCUMENT_RECEIVED`.
3. Mapear `oi/olá/menu/ajuda` para `GREETING`.
4. Mapear “fluxo”, “caixa”, “saldo”, `1` para `ASK_CASHFLOW`.
5. Mapear “continua”, “e agora”, “próximo”, “agora?” para `ASK_NEXT_STEP`.
6. Mapear “explica”, “isso está bom”, “por quê”, “o que acha” para `EXPLAIN_LAST_OUTCOME` com `requiresSlm=true` quando houver `lastOutcome`.
7. Testar todos os exemplos reais dos prints.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/intent-classifier.test.ts
```

---

### Task 4: Adicionar task SLM no roteador LLM

**Objective:** Permitir chamadas controladas do SLM para conversa WhatsApp.

**Files:**
- Modify: `src/llm/types.ts`
- Modify: `src/llm/router.ts`
- Create: `src/channels/whatsapp/conversation-graph/prompts/intent-classifier.ts`
- Create: `src/channels/whatsapp/conversation-graph/prompts/concise-cfo-reply.ts`
- Test: `tests/llm/router.test.ts`

**Steps:**
1. Adicionar `"whatsapp-conversation"` em `AgenticLlmTask` ou novo union específico.
2. Roteá-lo para SLM/flash-lite.
3. Criar prompt de classificação JSON com schema estrito.
4. Criar prompt de resposta CFO curta.
5. Garantir fallback OpenAI apenas se permitido pelo padrão atual do projeto.
6. Testar rota primária/fallback.

**Verification:**

```bash
npm test -- --run tests/llm/router.test.ts
```

---

### Task 5: Implementar LangGraph conversacional sem chamar SLM por padrão

**Objective:** Criar grafo que orquestra estado, auth, roteamento e resposta determinística.

**Files:**
- Create: `src/channels/whatsapp/conversation-graph/index.ts`
- Create: `src/channels/whatsapp/conversation-graph/nodes/auth-gate.ts`
- Create: `src/channels/whatsapp/conversation-graph/nodes/classify-intent.ts`
- Create: `src/channels/whatsapp/conversation-graph/nodes/deterministic-router.ts`
- Create: `src/channels/whatsapp/conversation-graph/nodes/persist-state.ts`
- Test: `tests/channels/whatsapp/conversation-graph.test.ts`

**Steps:**
1. Criar `Annotation.Root` do estado.
2. Criar `buildWhatsappConversationGraph()`.
3. `authGate` retorna link sem chamar SLM se número não vinculado.
4. `classifyIntent` usa classificador determinístico.
5. `deterministicRouter` resolve greetings, help, ask cashflow, next step, documents.
6. `persistState` grava em `IWhatsAppSessionStore`.
7. Testar que `oi`, `1`, `quero fluxo`, `vc nao continua` não chamam SLM.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/conversation-graph.test.ts
```

---

### Task 6: Integrar SLM para respostas ambíguas/consultivas

**Objective:** Chamar SLM apenas quando `requiresSlm=true` e budget permitir.

**Files:**
- Create: `src/channels/whatsapp/conversation-graph/nodes/slm-response.ts`
- Create: `src/channels/whatsapp/conversation-graph/slm-budget.ts`
- Test: `tests/channels/whatsapp/slm-response.test.ts`

**Steps:**
1. Criar `shouldUseSlm(state)`.
2. Criar budget guard por dia/conversa.
3. Construir payload curto para SLM.
4. Chamar `complete()`/adapter LLM existente via `src/llm/`.
5. Persistir uso em `state.slmUsage`.
6. Se SLM falhar, responder com fallback determinístico.
7. Testar que histórico bruto não entra no prompt.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/slm-response.test.ts
```

---

### Task 7: Substituir `processMessage` legado pelo grafo

**Objective:** Fazer webhook usar o grafo preservando ACK rápido e dedup.

**Files:**
- Modify: `src/channels/whatsapp/conversation-flow.ts`
- Modify: `src/channels/whatsapp/webhook.ts` somente se necessário
- Test: `tests/channels/whatsapp/conversation-flow.test.ts`

**Steps:**
1. Manter `findTenantByPhone`, ingest e helpers reutilizáveis ou mover para nodes.
2. `processMessage` passa a invocar `buildWhatsappConversationGraph().invoke(...)`.
3. Garantir que auth link continua antes de IA.
4. Garantir que documento continua processando background.
5. Garantir que fallback não chama `formatWelcomeMenu`.
6. Testar regressão do print: `1` → resposta útil; “Vc nao continua?” → continuação contextual.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/conversation-flow.test.ts tests/channels/whatsapp/response-formatter.test.ts
```

---

### Task 8: Modelar conversa passiva

**Objective:** Salvar contexto de notificações proativas para que respostas posteriores façam sentido.

**Files:**
- Modify: `src/channels/whatsapp/notification-service.ts`
- Create: `src/channels/whatsapp/conversation-graph/passive-context.ts`
- Test: `tests/channels/whatsapp/passive-context.test.ts`

**Steps:**
1. Criar helper `storePassiveContext(phone, tenantId, source, summary)`.
2. Ao enviar análise pronta, registrar `passiveContext.source="analysis_ready"`.
3. Ao enviar fluxo de caixa do extrato, registrar `passiveContext.source="ingest_done"`.
4. Definir TTL/expiração do contexto passivo.
5. Quando usuário responder “explica”, classificador usa `passiveContext`.
6. Testar que notificação passiva seguida de resposta curta roteia corretamente.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/passive-context.test.ts
```

---

### Task 9: Telemetria, custos e auditoria

**Objective:** Tornar cada decisão auditável e medir custo/token.

**Files:**
- Modify: `src/channels/whatsapp/message-log.ts`
- Create: `src/channels/whatsapp/conversation-graph/telemetry.ts`
- Test: `tests/channels/whatsapp/conversation-telemetry.test.ts`

**Steps:**
1. Logar `intent`, `stage`, `usedSlm`, `responseKind`, `latencyMs`.
2. Redigir PII/valores sensíveis conforme padrão de `message-log`.
3. Emitir LangSmith trace em chamadas SLM.
4. Adicionar campos agregáveis para taxa zero-token vs SLM.
5. Testar redaction.

**Metrics de aceite:**

- `% zero-token replies` alvo inicial ≥ 80%;
- `avg SLM cost per conversation` dentro de C3;
- `fallback_to_menu_count = 0`;
- `auth_gate_slm_calls = 0`;
- `document_flow_slm_calls = 0` para student/free tier.

---

### Task 10: Evals conversacionais

**Objective:** Criar suíte que valide fluxo ativo/passivo e consumo de tokens.

**Files:**
- Create: `tests/channels/whatsapp/conversation-scenarios.test.ts`
- Create: `docs/evals/whatsapp-conversation-pilot.md`

**Scenarios mínimos:**

1. não vinculado manda “oi” → link, zero SLM;
2. vinculado manda “quero fluxo de caixa” → pede extrato, zero SLM;
3. vinculado manda `1` → compatibilidade, pede extrato, zero SLM;
4. usuário manda extrato → confirmação + ingest background, zero SLM no ack;
5. após resultado, usuário manda “vc nao continua?” → continuação contextual, zero SLM;
6. após resultado, usuário manda “isso está bom?” → SLM permitido;
7. notificação passiva analysis_ready + usuário “explica” → usa passiveContext;
8. SLM indisponível → fallback determinístico sem erro ao usuário.

**Verification:**

```bash
npm test -- --run tests/channels/whatsapp/conversation-scenarios.test.ts
npm test -- --run tests/channels/whatsapp
```

---

## 9. Rollout recomendado

### Fase 0 — plano e spec

- Aprovar este plano.
- Registrar decisão em ADR se o menu numerado for oficialmente removido.

### Fase 1 — zero-token only

- Implementar LangGraph com SLM desligado por feature flag.
- Validar auth, extrato, fallback contextual, passivo básico.
- Métrica esperada: 100% zero-token para cenários básicos.

Feature flag sugerida:

```txt
WHATSAPP_CONVERSATION_GRAPH_ENABLED=true
WHATSAPP_CONVERSATION_SLM_ENABLED=false
```

### Fase 2 — SLM controlado em staging

- Ativar SLM apenas para intents `EXPLAIN_LAST_OUTCOME` e `ASK_NEXT_STEP` ambíguo.
- Medir custo e qualidade em LangSmith.

```txt
WHATSAPP_CONVERSATION_SLM_ENABLED=true
WHATSAPP_CONVERSATION_SLM_DAILY_LIMIT=10
```

### Fase 3 — PILOT produção

- Ativar para tenants piloto.
- Monitorar 7–14 dias:
  - resposta errada;
  - custo por conversa;
  - taxa de fallback;
  - reclamações “não entendeu”;
  - tempo até envio de extrato.

### Fase 4 — substituir fluxo legado

- Remover `MENU`, `CASHFLOW_QUERY` legados ou mantê-los apenas como aliases internos.
- Remover testes que esperam menu numerado para plano pago.

---

## 10. Definition of Done

- Nenhuma resposta de fallback contém menu numerado.
- Número não vinculado sempre recebe link antes de LangGraph/SLM.
- LangGraph preserva `lastOutcome`, `pendingAction` e `passiveContext`.
- Conversa ativa e passiva usam o mesmo estado.
- SLM só roda quando `requiresSlm=true` e budget permite.
- Testes cobrem os prints reais.
- Telemetria mostra custo/tokens por conversa.
- Feature flags permitem desligar SLM sem desligar o fluxo conversacional.
- PR inclui evidência de testes e plano de rollback.

---

## 11. Rollback

- `WHATSAPP_CONVERSATION_GRAPH_ENABLED=false` volta ao fluxo legado.
- `WHATSAPP_CONVERSATION_SLM_ENABLED=false` mantém LangGraph e desliga tokens.
- Se ingest for afetado, manter `handleIngestDocument` legado chamável diretamente.

---

## 12. Observações finais

A decisão importante é separar “conversa fluida” de “chamar IA”. LangGraph resolve fluidez, estado e transições. O SLM entra apenas para linguagem natural ambígua/consultiva. Assim, o Aicfo conversa melhor sem transformar todo WhatsApp em custo variável de token.
