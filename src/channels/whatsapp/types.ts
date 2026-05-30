// Tipos do módulo whatsapp-channel (provider: Unnichat BSP)
// C7 — IWhatsAppAdapter e IWhatsAppSessionStore abstraem o provider
// C8 — tenantId nunca hardcoded; sempre resolvido em runtime

export type WaMessageType =
  | "text"
  | "document"
  | "image"
  | "audio"
  | "interactive"
  | "button_reply"
  | "unknown"

export interface WaIncomingMessage {
  messageId: string
  from: string        // número E.164 do remetente
  timestamp: string   // ISO 8601
  type: WaMessageType
  text?: string       // presente quando type === "text"
  document?: {
    id: string        // media ID para download
    filename: string
    mimeType: string
    caption?: string
  }
  image?: {
    id: string
    mimeType: string
    caption?: string
  }
  buttonReply?: {
    id: string
    title: string
  }
}

export interface WaStatusUpdate {
  messageId: string
  from: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: string
}

export interface WaWebhookEvent {
  type: "message" | "status"
  message?: WaIncomingMessage
  status?: WaStatusUpdate
}

// Estado da sessão conversacional (persistido em Redis)
export type WaSessionStep =
  | "IDLE"
  | "ONBOARDING"
  | "AWAITING_AUTH"
  | "MENU"
  | "CASHFLOW_QUERY"
  | "INGEST_FLOW"

export interface WaSession {
  phoneE164: string
  tenantId: string | null
  step: WaSessionStep
  context: Record<string, unknown> // dados temporários do fluxo atual
  createdAt: string
  updatedAt: string
}

// Resultado de envio de mensagem
export interface WaSendResult {
  messageId: string
  status: "queued" | "failed"
  error?: string
}

// Interface do adapter (C7 — abstrai o provider Unnichat/Meta)
export interface IWhatsAppAdapter {
  sendText(to: string, text: string): Promise<WaSendResult>
  sendDocument(to: string, url: string, filename: string, caption?: string): Promise<WaSendResult>
  downloadMedia(mediaId: string): Promise<Buffer>
}

// Interface do session store (C7 — abstrai Redis)
export interface IWhatsAppSessionStore {
  get(phoneE164: string): Promise<WaSession | null>
  set(session: WaSession, ttlSeconds?: number): Promise<void>
  del(phoneE164: string): Promise<void>
}
