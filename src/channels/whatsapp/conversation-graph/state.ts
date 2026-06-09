import type { WaIncomingMessage, WaSession } from "../types.js"

export type WaConversationStage =
  | "AWAITING_AUTH"
  | "READY_FOR_INPUT"
  | "AWAITING_STATEMENT"
  | "INGESTING_STATEMENT"
  | "SHOWING_CASHFLOW"
  | "EXPLAINING_RESULT"
  | "AWAITING_CLARIFICATION"
  | "ESCALATION_OR_SUPPORT"

export type WaConversationMode = "active" | "passive"

export type WaIntent =
  | "GREETING"
  | "ASK_CASHFLOW"
  | "SEND_STATEMENT_HELP"
  | "DOCUMENT_RECEIVED"
  | "EXPLAIN_LAST_OUTCOME"
  | "ASK_NEXT_STEP"
  | "ASK_STATUS"
  | "ASK_MONTHLY_ANALYSIS"
  | "CAPABILITIES_HELP"
  | "AUTH_HELP"
  | "CONFIRMATION"
  | "NEGATION"
  | "HUMAN_SUPPORT"
  | "UNKNOWN"

export interface WaLastOutcome {
  type:
    | "cashflow_today"
    | "cashflow_statement"
    | "weekly_summary"
    | "analysis_ready"
    | "auth_link"
    | "ingest_received"
  summary: string
  dataRef?: string
  createdAt: string
}

export interface WaPassiveContext {
  source: "analysis_ready" | "ingest_done" | "cashflow_alert" | "reminder" | "daily_cashflow"
  summary: string
  createdAt: string
  expiresAt: string
}

export interface WaConversationState {
  phoneE164: string
  tenantId: string | null
  userName?: string
  plan?: string
  stage: WaConversationStage
  mode: WaConversationMode
  lastIntent?: WaIntent
  lastUserMessage?: string
  lastBotAction?: string
  lastOutcome?: WaLastOutcome
  pendingAction?: "send_statement" | "wait_ingest" | "choose_next_step" | "link_account"
  passiveContext?: WaPassiveContext
  conversationSummary?: string
  slmUsage?: {
    date: string
    callCount: number
    costCents: number
  }
  updatedAt: string
}

export interface WaTenantConversationInfo {
  id: string
  name: string
  plan: string
  userName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function getConversationState(session: WaSession): WaConversationState | null {
  const raw = session.context["conversation"]
  if (!isRecord(raw)) return null
  if (typeof raw["phoneE164"] !== "string") return null
  if (typeof raw["stage"] !== "string") return null
  return raw as unknown as WaConversationState
}

export function buildConversationState(
  session: WaSession,
  tenant?: WaTenantConversationInfo | null,
): WaConversationState {
  const existing = getConversationState(session)
  const now = new Date().toISOString()
  return {
    phoneE164: session.phoneE164,
    tenantId: tenant?.id ?? session.tenantId,
    userName: tenant?.userName ?? existing?.userName,
    plan: tenant?.plan ?? existing?.plan,
    stage: tenant ? (existing?.stage ?? "READY_FOR_INPUT") : "AWAITING_AUTH",
    mode: existing?.mode ?? "active",
    lastIntent: existing?.lastIntent,
    lastUserMessage: existing?.lastUserMessage,
    lastBotAction: existing?.lastBotAction,
    lastOutcome: existing?.lastOutcome,
    pendingAction: tenant ? existing?.pendingAction : "link_account",
    passiveContext: existing?.passiveContext,
    conversationSummary: existing?.conversationSummary,
    slmUsage: existing?.slmUsage,
    updatedAt: now,
  }
}

export function withConversationState(session: WaSession, conversation: WaConversationState): WaSession {
  return {
    ...session,
    tenantId: conversation.tenantId,
    context: {
      ...session.context,
      conversation,
    },
    updatedAt: new Date().toISOString(),
  }
}

export function rawTextFromMessage(msg: WaIncomingMessage): string {
  if (msg.type === "button_reply") return msg.buttonReply?.title ?? ""
  return msg.text ?? msg.document?.caption ?? msg.image?.caption ?? ""
}
