// conversation-flow.ts — whatsapp-channel
// State machine: processa cada mensagem recebida e executa a resposta via adapter.
// C7 — depende somente de IWhatsAppAdapter e IWhatsAppSessionStore (abstrações); provider é injetado.
// C8 — tenantId sempre resolvido da sessão Redis; nunca hardcoded.

import { randomUUID } from "node:crypto"

import { logger } from "@/observability/logger.js"
import { signWhatsAppLinkToken, appBaseUrl } from "./link-token.js"
import { getPrisma } from "@/persistence/prisma.js"
import { getCashflowSummaryDay, getCashflow } from "@/cashflow/service.js"
import {
  formatCashflowSummary,
  formatCashflowPeriod,
  formatCashflowStatement,
  formatWelcomeMenu,
  formatError,
  formatIngestReceived,
  formatStudentCashflowHint,
} from "./response-formatter.js"
import { classifyCommand, isSupportedDocument } from "./message-parser.js"
import { handleIngestDocument as ingestDoc } from "./ingest-handler.js"
import { decideWhatsappConversation } from "./conversation-graph/index.js"
import { buildConversationState, withConversationState, getConversationState } from "./conversation-graph/state.js"
import type { WaConversationState } from "./conversation-graph/state.js"
import { cashflowToMetrics, encodeOutcomeMetrics, buildCashflowOutcomeSummary } from "./conversation-graph/explanation.js"
import type { CashflowResponse } from "@/cashflow/types.js"
import type { WaIncomingMessage, WaSession, WaSessionStep, IWhatsAppSessionStore, IWhatsAppAdapter } from "./types.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna hoje em YYYY-MM-DD no timezone de São Paulo. */
function todayBRT(): string {
  return new Date()
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    .split("/")
    .reverse()
    .join("-") // dd/mm/yyyy → yyyy-mm-dd
}

/**
 * Retorna { startDate, endDate } para os últimos N dias (inclusive hoje).
 * Datas em YYYY-MM-DD no timezone de São Paulo.
 */
function lastNDaysBRT(n: number): { startDate: string; endDate: string } {
  const tz = "America/Sao_Paulo"
  const endDate = new Date().toLocaleDateString("pt-BR", { timeZone: tz }).split("/").reverse().join("-")
  const startMs = Date.now() - (n - 1) * 24 * 60 * 60 * 1000
  const startDate = new Date(startMs).toLocaleDateString("pt-BR", { timeZone: tz }).split("/").reverse().join("-")
  return { startDate, endDate }
}

/**
 * Busca tenant pelo número E.164 e retorna apenas os campos necessários.
 * Retorna null se não encontrado ou se whatsappEnabled=false.
 */
async function findTenantByPhone(phone: string): Promise<{
  id: string
  name: string
  plan: string
  userName?: string
} | null> {
  const prisma = getPrisma()
  // A Meta entrega o `from`/wa_id em E.164 SEM o '+', mas whatsappPhone é sempre
  // persistido COM '+' (regex E.164 no register e no PATCH /config/whatsapp).
  // Sem normalizar, a query nunca casa e o usuário fica preso em loop de magic-link.
  const candidates = phone.startsWith("+") ? [phone] : [`+${phone}`, phone]
  const tenant = await prisma.tenant.findFirst({
    where: { whatsappPhone: { in: candidates }, whatsappEnabled: true },
    select: {
      id: true,
      name: true,
      users: { select: { name: true }, orderBy: { createdAt: "asc" }, take: 1 },
      subscriptions: {
        select: { plan: true },
        take: 1,
      },
    },
  })
  if (!tenant) return null
  return {
    id: tenant.id,
    name: tenant.name,
    userName: tenant.users[0]?.name ?? undefined,
    plan: tenant.subscriptions[0]?.plan ?? "trial",
  }
}

/** Constrói uma sessão nova (ou IDLE) para o número dado. */
function buildFreshSession(phone: string): WaSession {
  const now = new Date().toISOString()
  return {
    phoneE164: phone,
    tenantId: null,
    step: "IDLE",
    context: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Atualiza o step da sessão e persiste. */
async function transitionTo(
  session: WaSession,
  nextStep: WaSessionStep,
  store: IWhatsAppSessionStore,
  extra?: Partial<WaSession>,
): Promise<WaSession> {
  const updated: WaSession = {
    ...session,
    ...extra,
    step: nextStep,
    updatedAt: new Date().toISOString(),
  }
  await store.set(updated)
  logger.info(
    { from: session.phoneE164, step: nextStep, prevStep: session.step },
    "whatsapp:flow — step transition",
  )
  return updated
}

/**
 * Calcula e envia o fluxo de caixa do período exato do extrato recém-ingerido.
 * O range vem das datas reais dos lançamentos (min/max), não de um mês fixo —
 * é o "conforme o extrato enviado". Sem LLM: pura agregação determinística.
 */
async function sendStatementCashflow(
  phone: string,
  tenantId: string,
  analysisId: string,
  adapter: IWhatsAppAdapter,
): Promise<CashflowResponse | null> {
  const prisma = getPrisma()
  const range = await prisma.ledgerEntry.aggregate({
    where: { analysisId },
    _min: { date: true },
    _max: { date: true },
  })
  const min = range._min.date
  const max = range._max.date
  if (!min || !max) {
    logger.warn({ tenantId, analysisId }, "whatsapp:ingest — sem range de datas; não há caixa a enviar")
    return null
  }

  const requestId = randomUUID()
  const cashflow = await getCashflow({
    tenantId,
    startDate: min.toISOString().slice(0, 10),
    endDate: max.toISOString().slice(0, 10),
    granularity: "daily",
    requestId,
  })
  await adapter.sendText(phone, formatCashflowStatement(cashflow))
  return cashflow
}

/**
 * Grava os números reais do extrato no lastOutcome do estado conversacional.
 * Sem isto, "me explica o resultado" não tinha os dados e acabava ecoando a
 * saudação anterior. Só persiste se já existe estado conversacional (o fluxo
 * legado não consome lastOutcome). Relê a sessão atual do store para não
 * sobrescrever uma transição mais recente do usuário (race do background).
 */
async function persistCashflowOutcome(
  store: IWhatsAppSessionStore,
  phone: string,
  cashflow: CashflowResponse,
): Promise<void> {
  const current = await store.get(phone)
  if (!current) return
  const conversation = getConversationState(current)
  if (!conversation) return

  const metrics = cashflowToMetrics(cashflow)
  const updated: WaConversationState = {
    ...conversation,
    lastOutcome: {
      type: "cashflow_statement",
      summary: buildCashflowOutcomeSummary(metrics),
      dataRef: encodeOutcomeMetrics(metrics),
      createdAt: new Date().toISOString(),
    },
  }
  await store.set(withConversationState(current, updated))
}

/**
 * Executa o ingest em background sem bloquear a resposta ao usuário.
 * Quando keepAllEntries=true (fluxo do aluno), já devolve o fluxo de caixa do
 * extrato automaticamente — o aluno não precisa pedir.
 */
function ingestDocumentBackground(
  msg: WaIncomingMessage,
  tenantId: string,
  adapter: IWhatsAppAdapter,
  opts: { skipAnalysis?: boolean; keepAllEntries?: boolean; store?: IWhatsAppSessionStore },
): void {
  ingestDoc(msg, tenantId, adapter, opts).then(async (result) => {
    if ("error" in result) {
      logger.error({ tenantId, error: result.error }, "whatsapp:ingest — background ingest falhou")
      await adapter.sendText(msg.from, result.error).catch((sendErr) => {
        logger.error({ tenantId, sendErr }, "whatsapp:ingest — falha ao avisar erro de ingest ao usuário")
      })
      return
    }
    logger.info({ tenantId, analysisId: result.analysisId, entryCount: result.entryCount }, "whatsapp:ingest — concluído")
    if (opts.keepAllEntries && result.entryCount > 0) {
      const cashflow = await sendStatementCashflow(msg.from, tenantId, result.analysisId, adapter)
      if (cashflow && opts.store) {
        await persistCashflowOutcome(opts.store, msg.from, cashflow)
      }
    }
  }).catch((err) => {
    logger.error({ tenantId, err }, "whatsapp:ingest — exceção no background ingest")
  })
}

// ---------------------------------------------------------------------------
// Handlers por step
// ---------------------------------------------------------------------------

async function handleIdleOrOnboarding(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  const tenant = await findTenantByPhone(msg.from)

  if (tenant) {
    // Tenant reconhecido → entra no MENU e processa o CONTEÚDO da mensagem direto
    // (documento/comando) via handleMenu. Sem isto, a 1a mensagem de uma sessão nova
    // (ex.: extrato enviado depois da sessão Redis de 30min expirar) era ignorada e o
    // menu era mostrado, obrigando o usuário a reenviar. Greeting cai no UNKNOWN do
    // handleMenu, que mostra o menu de boas-vindas (comportamento preservado).
    await transitionTo(session, "MENU", deps.store, { tenantId: tenant.id })
    await handleMenu(msg, { ...session, step: "MENU", tenantId: tenant.id }, deps)
    return
  }

  // Tenant não encontrado ou whatsappEnabled=false → enviar magic link
  const token = await signWhatsAppLinkToken(msg.from)
  const link = `${appBaseUrl()}/whatsapp/auth?token=${token}`
  const text =
    `Olá! 👋 Para usar o Aicfo pelo WhatsApp, vincule seu número à sua conta:\n\n` +
    `🔗 ${link}\n\n` +
    `_O link expira em 1 hora._`

  await deps.adapter.sendText(msg.from, text)
  await transitionTo(session, "AWAITING_AUTH", deps.store)
}

async function handleAwaitingAuth(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  // Verificar se o tenant foi vinculado desde a última mensagem
  const tenant = await findTenantByPhone(msg.from)

  if (tenant) {
    // Acabou de vincular → entra no MENU e processa o conteúdo direto (igual onboarding).
    await transitionTo(session, "MENU", deps.store, { tenantId: tenant.id })
    await handleMenu(msg, { ...session, step: "MENU", tenantId: tenant.id }, deps)
    return
  }

  // Ainda sem vínculo — reenviar link
  const token = await signWhatsAppLinkToken(msg.from)
  const link = `${appBaseUrl()}/whatsapp/auth?token=${token}`
  const text =
    `⏳ Seu número ainda não está vinculado a nenhuma conta Aicfo.\n\n` +
    `Use o link para vincular:\n🔗 ${link}\n\n` +
    `_O link expira em 1 hora._`

  await deps.adapter.sendText(msg.from, text)
  // Manter step em AWAITING_AUTH (sem transição)
}

async function handleCashflowQuery(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  // tenantId garantido pela transição para CASHFLOW_QUERY somente quando session.tenantId != null
  const tenantId = session.tenantId as string
  const requestId = randomUUID()
  const date = todayBRT()

  const summaryDay = await getCashflowSummaryDay({ tenantId, date, requestId })
  const text = formatCashflowSummary(summaryDay)
  await deps.adapter.sendText(msg.from, text)
  await transitionTo(session, "MENU", deps.store)
}

async function handleCashflowWeek(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  const tenantId = session.tenantId as string
  const requestId = randomUUID()
  const { startDate, endDate } = lastNDaysBRT(7)

  const cashflowData = await getCashflow({
    tenantId,
    startDate,
    endDate,
    granularity: "daily",
    requestId,
  })

  const text = formatCashflowPeriod(cashflowData)
  await deps.adapter.sendText(msg.from, text)
  await transitionTo(session, "MENU", deps.store)
}

async function handleIngestDocument(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
  plan: string,
): Promise<void> {
  const filename = msg.document?.filename ?? "arquivo"
  const isStudent = plan === "student"
  // Confirma recebimento imediatamente
  await deps.adapter.sendText(msg.from, formatIngestReceived(filename, isStudent))
  await transitionTo(session, "INGEST_FLOW", deps.store, {
    context: {
      ...session.context,
      mediaId: msg.document?.id,
      filename,
    },
  })
  // Dispara ingest em background — student: parse+store (zero LLM) + caixa do extrato;
  // pago: pipeline completo (classificação → DRE → plano de ação).
  if (msg.document?.id && session.tenantId) {
    ingestDocumentBackground(msg, session.tenantId, deps.adapter, {
      skipAnalysis: isStudent,
      keepAllEntries: isStudent,
      store: deps.store,
    })
  }
}

/**
 * Busca o plano da subscription do tenant.
 * Retorna "trial" como fallback se não encontrado.
 */
async function getTenantPlan(tenantId: string): Promise<string> {
  const prisma = getPrisma()
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return subscription?.plan ?? "trial"
}

/**
 * Nome para a saudação: primeiro nome do usuário (mais pessoal) em vez do nome da
 * empresa/tenant. Usa o usuário mais antigo do tenant; cai no nome do tenant se não houver.
 */
async function greetingName(tenantId: string): Promise<string> {
  const prisma = getPrisma()
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      users: { select: { name: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  })
  const userName = tenant?.users[0]?.name?.trim()
  if (userName) return userName.split(/\s+/)[0]!
  return tenant?.name ?? ""
}

async function handleMenu(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  const tenantId = session.tenantId as string

  // Documento recebido → ingest permitido para todos os planos.
  // Plano student: skipAnalysis=true (parse+store apenas, sem LLM).
  // Planos pagos: pipeline completo (classificação → DRE → plano de ação).
  if (isSupportedDocument(msg)) {
    const plan = await getTenantPlan(tenantId)
    await handleIngestDocument(msg, session, deps, plan)
    return
  }

  // Classificar comando a partir do texto (ou button_reply)
  const rawText = msg.type === "button_reply"
    ? (msg.buttonReply?.title ?? "")
    : (msg.text ?? "")

  const command = classifyCommand(rawText)

  logger.info(
    { from: msg.from, step: session.step, command },
    "whatsapp:flow — command dispatched",
  )

  // Free tier do aluno não tem dado contínuo: caixa/semana voltariam R$ 0,00.
  // Orienta a enviar o extrato em vez de mostrar um caixa vazio e confuso.
  if (command === "CAIXA" || command === "SEMANA") {
    const plan = await getTenantPlan(tenantId)
    if (plan === "student") {
      await deps.adapter.sendText(msg.from, formatStudentCashflowHint())
      return
    }
  }

  switch (command) {
    case "MENU": {
      const plan = await getTenantPlan(tenantId)
      const menuText = formatWelcomeMenu(await greetingName(tenantId), plan)
      await deps.adapter.sendText(msg.from, menuText)
      break
    }

    case "CAIXA": {
      await transitionTo(session, "CASHFLOW_QUERY", deps.store)
      await handleCashflowQuery(msg, { ...session, step: "CASHFLOW_QUERY" }, deps)
      break
    }

    case "SEMANA": {
      await handleCashflowWeek(msg, session, deps)
      break
    }

    case "ANALISE": {
      // Verificar plano — student não acessa análise
      const plan = await getTenantPlan(tenantId)
      if (plan === "student") {
        await deps.adapter.sendText(msg.from, formatError("PLAN_LIMIT"))
        return
      }
      // Redirecionar ao app para análise completa
      const text =
        `📊 *Análise financeira mensal*\n\n` +
        `Acesse o app para ver sua análise completa:\n` +
        `🔗 ${appBaseUrl()}/hub\n\n` +
        `_Aicfo · CFO-IA_`
      await deps.adapter.sendText(msg.from, text)
      break
    }

    case "STATUS": {
      const plan = await getTenantPlan(tenantId)
      const text =
        `ℹ️ *Status da sua conta*\n\n` +
        `Plano: *${plan}*\n` +
        `Canal WhatsApp: ✅ Ativo\n\n` +
        `_Aicfo · CFO-IA_`
      await deps.adapter.sendText(msg.from, text)
      break
    }

    case "UNKNOWN":
    default: {
      // Texto não reconhecido → reenviar menu de ajuda
      const plan = await getTenantPlan(tenantId)
      const helpText = formatWelcomeMenu(await greetingName(tenantId), plan)
      await deps.adapter.sendText(msg.from, helpText)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Fluxo conversacional LangGraph (zero-token por padrão)
// ---------------------------------------------------------------------------

function conversationGraphEnabled(): boolean {
  return process.env.WHATSAPP_CONVERSATION_GRAPH_ENABLED === "true"
}

async function sendAuthLink(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { store: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
  prefix?: string,
): Promise<void> {
  const token = await signWhatsAppLinkToken(msg.from)
  const link = `${appBaseUrl()}/whatsapp/auth?token=${token}`
  const text =
    (prefix ?? `Olá! 👋 Para usar o Aicfo pelo WhatsApp, vincule seu número à sua conta:`) +
    `\n\n🔗 ${link}\n\n` +
    `_O link expira em 1 hora._`

  await deps.adapter.sendText(msg.from, text)
  const conversation = buildConversationState(session, null)
  await transitionTo(withConversationState(session, conversation), "AWAITING_AUTH", deps.store)
}

async function sendStatus(
  msg: WaIncomingMessage,
  tenantId: string,
  deps: { adapter: IWhatsAppAdapter },
): Promise<void> {
  const plan = await getTenantPlan(tenantId)
  const text =
    `ℹ️ *Status da sua conta*\n\n` +
    `Plano: *${plan}*\n` +
    `Canal WhatsApp: ✅ Ativo\n\n` +
    `_Aicfo · CFO-IA_`
  await deps.adapter.sendText(msg.from, text)
}

async function sendMonthlyAnalysisLink(
  msg: WaIncomingMessage,
  tenantId: string,
  deps: { adapter: IWhatsAppAdapter },
): Promise<void> {
  const plan = await getTenantPlan(tenantId)
  if (plan === "student") {
    await deps.adapter.sendText(msg.from, formatError("PLAN_LIMIT"))
    return
  }
  const text =
    `📊 *Análise financeira mensal*\n\n` +
    `Acesse o app para ver sua análise completa:\n` +
    `🔗 ${appBaseUrl()}/hub\n\n` +
    `_Aicfo · CFO-IA_`
  await deps.adapter.sendText(msg.from, text)
}

function applyConversationOutcome(
  decision: Awaited<ReturnType<typeof decideWhatsappConversation>>,
): WaConversationState {
  // Preserva o lastOutcome real (o resultado do extrato, gravado pelo background
  // com os números e o dataRef). NÃO deriva outcome do texto da resposta: fazer isso
  // sobrescrevia o resultado financeiro com a saudação ("Olá, Rafael!") e perdia os
  // números — era a causa do "me explica o resultado" ecoar a saudação.
  return {
    ...decision.conversation,
    lastBotAction: decision.route,
  }
}

async function processMessageWithConversationGraph(
  msg: WaIncomingMessage,
  session: WaSession,
  deps: { sessionStore: IWhatsAppSessionStore; adapter: IWhatsAppAdapter },
): Promise<void> {
  const tenant = await findTenantByPhone(msg.from)
  if (!tenant) {
    await sendAuthLink(msg, session, { store: deps.sessionStore, adapter: deps.adapter })
    return
  }

  const baseSession: WaSession = { ...session, tenantId: tenant.id, step: "MENU" }
  const conversation = buildConversationState(baseSession, tenant)
  const decision = await decideWhatsappConversation(msg, conversation)

  logger.info(
    { from: msg.from, intent: decision.intent, route: decision.route, usedSlm: decision.usedSlm },
    "whatsapp:conversation-graph — decision",
  )

  switch (decision.route) {
    case "HANDLE_DOCUMENT": {
      const persisted = withConversationState(baseSession, applyConversationOutcome(decision))
      await handleIngestDocument(msg, persisted, { store: deps.sessionStore, adapter: deps.adapter }, tenant.plan)
      return
    }

    case "STATUS":
      await sendStatus(msg, tenant.id, { adapter: deps.adapter })
      break

    case "MONTHLY_ANALYSIS":
      await sendMonthlyAnalysisLink(msg, tenant.id, { adapter: deps.adapter })
      break

    case "SEND_TEXT":
    case "NEED_SLM":
    default:
      if (decision.responseText) {
        await deps.adapter.sendText(msg.from, decision.responseText)
      }
      break
  }

  const updatedConversation = applyConversationOutcome(decision)
  await deps.sessionStore.set(withConversationState(baseSession, updatedConversation))
}

// ---------------------------------------------------------------------------
// Entrypoint público
// ---------------------------------------------------------------------------

/**
 * Processa uma mensagem recebida do WhatsApp e executa a resposta via adapter.
 * Garante que o usuário sempre recebe uma resposta — em caso de erro inesperado,
 * envia formatError("GENERIC") e retorna o step para MENU.
 *
 * C8 — tenantId sempre vem da sessão Redis; nunca hardcoded.
 */
export async function processMessage(
  msg: WaIncomingMessage,
  deps: {
    sessionStore: IWhatsAppSessionStore
    adapter: IWhatsAppAdapter
  },
): Promise<void> {
  const { sessionStore, adapter } = deps

  // Carregar ou inicializar sessão
  let session = await sessionStore.get(msg.from) ?? buildFreshSession(msg.from)

  logger.info(
    { from: msg.from, step: session.step, messageId: msg.messageId, type: msg.type },
    "whatsapp:flow — message received",
  )

  try {
    if (conversationGraphEnabled()) {
      await processMessageWithConversationGraph(msg, session, { sessionStore, adapter })
      return
    }

    switch (session.step) {
      case "IDLE":
      case "ONBOARDING":
        await handleIdleOrOnboarding(msg, session, { store: sessionStore, adapter })
        break

      case "AWAITING_AUTH":
        await handleAwaitingAuth(msg, session, { store: sessionStore, adapter })
        break

      case "MENU":
        await handleMenu(msg, session, { store: sessionStore, adapter })
        break

      case "CASHFLOW_QUERY":
        // Pode chegar nova mensagem enquanto query está em andamento — tratar como MENU
        await handleMenu(msg, session, { store: sessionStore, adapter })
        break

      case "INGEST_FLOW":
        // Documento adicional ou mensagem de texto durante ingest → retornar ao menu
        await transitionTo(session, "MENU", sessionStore)
        await handleMenu(msg, { ...session, step: "MENU" }, { store: sessionStore, adapter })
        break

      default: {
        // Step desconhecido — resetar para MENU como salvaguarda
        const _exhaustive: never = session.step
        logger.warn({ from: msg.from, step: _exhaustive }, "whatsapp:flow — step desconhecido, resetando para MENU")
        session = await transitionTo(session, "MENU", sessionStore, { tenantId: session.tenantId })
        await handleMenu(msg, session, { store: sessionStore, adapter })
      }
    }
  } catch (err) {
    logger.error(
      { from: msg.from, step: session.step, err },
      "whatsapp:flow — erro inesperado; enviando GENERIC",
    )
    try {
      await adapter.sendText(msg.from, formatError("GENERIC"))
    } catch (sendErr) {
      logger.error({ from: msg.from, sendErr }, "whatsapp:flow — falha ao enviar mensagem de erro fallback")
    }
    // Tentar resetar step para MENU para não travar a sessão
    try {
      await transitionTo(session, "MENU", sessionStore)
    } catch (resetErr) {
      logger.error({ from: msg.from, resetErr }, "whatsapp:flow — falha ao resetar step para MENU")
    }
  }
}
