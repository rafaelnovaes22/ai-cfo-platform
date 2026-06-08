// message-log.ts — whatsapp-channel (ADR-017)
// Log append-only de mensagens do canal para visibilidade do operador.
// Registra envios (sent/failed) E supressões por opt-out (skipped_disabled).
// Redação ADR-018 §5: o body de mensagens de caixa NÃO persiste valores —
// o caso de uso do operador é atendido por kind + status, mantendo o log não-sensível.
// C8 — tenantId nunca hardcoded; sempre resolvido em runtime.

import { Prisma } from "@prisma/client"
import { getPrisma } from "@/persistence/prisma.js"
import { logger } from "@/observability/logger.js"
import type { WaSendResult } from "./types.js"

export type WaMsgDirection = "outbound" | "inbound"
export type WaMsgKind =
  | "daily_cashflow"
  | "cashflow_from_statement"
  | "analysis_ready"
  | "reply"
  | "other"
export type WaMsgStatus = "sent" | "delivered" | "read" | "failed" | "skipped_disabled"

const RETENTION_DAYS = 180

// Kinds cujo conteúdo carrega valores financeiros agregados (ADR-018) — o body
// persistido é redigido para o log não reter o número.
const CASHFLOW_KINDS = new Set<WaMsgKind>(["daily_cashflow", "cashflow_from_statement"])

/**
 * Deriva o body a persistir a partir do kind (ADR-018 §5).
 * - Caixa: rótulo fixo, sem valores.
 * - Inbound (reply): rótulo genérico — evita reter texto livre/PII do usuário.
 * - Demais (analysis_ready/other): texto já não-sensível (contexto + link).
 */
function redactBody(kind: WaMsgKind, direction: WaMsgDirection, rawBody: string): string {
  if (CASHFLOW_KINDS.has(kind)) return "📊 Resumo de caixa enviado (valores omitidos do log — ADR-018)"
  if (direction === "inbound") return "(mensagem recebida do usuário)"
  return rawBody
}

function mapSendStatus(result: WaSendResult): WaMsgStatus {
  // Adapter retorna queued|failed; queued = aceito pelo provider → "sent".
  // delivered/read chegam depois via webhook (updateStatusByProviderId).
  return result.status === "failed" ? "failed" : "sent"
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/** Registra uma mensagem efetivamente enviada (ou que falhou no envio). */
export async function logOutbound(params: {
  tenantId: string
  kind: WaMsgKind
  body: string
  result: WaSendResult
}): Promise<void> {
  await safeCreate({
    tenantId: params.tenantId,
    direction: "outbound",
    kind: params.kind,
    body: redactBody(params.kind, "outbound", params.body),
    status: mapSendStatus(params.result),
    providerMessageId: params.result.status === "failed" ? null : params.result.messageId,
    error: params.result.error ?? null,
  })
}

/** Registra uma notificação SUPRIMIDA por opt-out (whatsappEnabled/notificationsEnabled = false). */
export async function logSkipped(params: {
  tenantId: string
  kind: WaMsgKind
}): Promise<void> {
  await safeCreate({
    tenantId: params.tenantId,
    direction: "outbound",
    kind: params.kind,
    body: redactBody(params.kind, "outbound", ""),
    status: "skipped_disabled",
    providerMessageId: null,
    error: null,
  })
}

/** Registra uma mensagem recebida do usuário (idempotente por providerMessageId). */
export async function logInbound(params: {
  tenantId: string
  providerMessageId: string
}): Promise<void> {
  const db = getPrisma()
  // Idempotência: a Meta reentrega webhooks; sem isto, cada reentrega/reprocesso
  // criaria uma nova linha inbound para a mesma mensagem.
  try {
    const existing = await db.whatsappMessage.findFirst({
      where: { providerMessageId: params.providerMessageId, direction: "inbound" },
      select: { id: true },
    })
    if (existing) return
  } catch (err) {
    logger.warn({ providerMessageId: params.providerMessageId, err }, "whatsapp:message-log — falha ao checar inbound existente")
  }
  await safeCreate({
    tenantId: params.tenantId,
    direction: "inbound",
    kind: "reply",
    body: redactBody("reply", "inbound", ""),
    status: "delivered",
    providerMessageId: params.providerMessageId,
    error: null,
  })
}

/** Atualiza o status (delivered/read/failed) de uma mensagem outbound via evento do webhook. */
export async function updateStatusByProviderId(
  providerMessageId: string,
  status: WaMsgStatus,
): Promise<void> {
  const db = getPrisma()
  try {
    await db.whatsappMessage.updateMany({
      where: { providerMessageId, direction: "outbound" },
      data: { status },
    })
  } catch (err) {
    // Log nunca deve quebrar o fluxo do canal.
    logger.warn({ providerMessageId, status, err }, "whatsapp:message-log — falha ao atualizar status")
  }
}

// Inserção tolerante a falha: o log é observabilidade, não pode derrubar o envio.
async function safeCreate(data: {
  tenantId: string
  direction: WaMsgDirection
  kind: WaMsgKind
  body: string
  status: WaMsgStatus
  providerMessageId: string | null
  error: string | null
}): Promise<void> {
  const db = getPrisma()
  try {
    await db.whatsappMessage.create({ data })
  } catch (err) {
    logger.warn({ tenantId: data.tenantId, kind: data.kind, err }, "whatsapp:message-log — falha ao persistir")
  }
}

// ── Leitura (listagem paginada por cursor) ───────────────────────────────────

export interface ListMessagesParams {
  tenantId: string
  status?: WaMsgStatus
  direction?: WaMsgDirection
  from?: string // ISO
  to?: string // ISO
  cursor?: string // id da última linha da página anterior
  limit: number
}

export interface MessageView {
  id: string
  direction: WaMsgDirection
  kind: WaMsgKind
  body: string
  status: WaMsgStatus
  providerMessageId: string | null
  error: string | null
  createdAt: string
}

export interface MessagePage {
  items: MessageView[]
  nextCursor: string | null
}

export async function listMessages(params: ListMessagesParams): Promise<MessagePage> {
  const db = getPrisma()

  const createdAt: Prisma.DateTimeFilter = {}
  if (params.from) createdAt.gte = new Date(params.from)
  if (params.to) createdAt.lte = new Date(params.to)

  const where: Prisma.WhatsappMessageWhereInput = {
    tenantId: params.tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.direction ? { direction: params.direction } : {}),
    ...(params.from || params.to ? { createdAt } : {}),
  }

  const rows = await db.whatsappMessage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.limit + 1, // +1 para detectar próxima página sem segunda query
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > params.limit
  const page = hasMore ? rows.slice(0, params.limit) : rows

  return {
    items: page.map((r) => ({
      id: r.id,
      direction: r.direction as WaMsgDirection,
      kind: r.kind as WaMsgKind,
      body: r.body,
      status: r.status as WaMsgStatus,
      providerMessageId: r.providerMessageId,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  }
}

// ── Retenção (ADR-017) ───────────────────────────────────────────────────────

/** Apaga mensagens com createdAt < now - RETENTION_DAYS. Retorna a contagem removida. */
export async function purgeExpiredMessages(retentionDays = RETENTION_DAYS): Promise<number> {
  const db = getPrisma()
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)
  const { count } = await db.whatsappMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  if (count > 0) {
    logger.info({ count, retentionDays }, "whatsapp:message-log — purge de retenção concluído")
  }
  return count
}
