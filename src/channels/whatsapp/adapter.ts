// Adapter Meta Cloud API para o módulo whatsapp-channel
// C7 — MetaAdapter implementa IWhatsAppAdapter; trocar provider = nova classe, zero mudança upstream
// C8 — todas as credenciais resolvidas em runtime via env vars; nenhum tenantId hardcoded

import { logger } from "@/observability/logger.js"
import type { IWhatsAppAdapter, WaSendResult } from "./types.js"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface MetaConfig {
  /** META_API_URL — padrão: https://graph.facebook.com/v19.0 */
  apiUrl: string
  /** META_ACCESS_TOKEN — token permanente gerado no Meta Business Manager */
  accessToken: string
  /** META_PHONE_NUMBER_ID — ID do número no Meta */
  phoneNumberId: string
  /** META_WEBHOOK_VERIFY_TOKEN — token para verificação do webhook */
  webhookToken: string
}

/**
 * Lê as variáveis de ambiente e devolve a config validada.
 * Lança `Error` descritivo se as obrigatórias estiverem ausentes.
 */
export function getMetaConfig(): MetaConfig {
  const accessToken = process.env["META_ACCESS_TOKEN"]
  const phoneNumberId = process.env["META_PHONE_NUMBER_ID"]

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "META_ACCESS_TOKEN e META_PHONE_NUMBER_ID são obrigatórios. Configure no .env"
    )
  }

  return {
    apiUrl: (process.env["META_API_URL"] ?? "https://graph.facebook.com/v19.0").replace(/\/$/, ""),
    accessToken,
    phoneNumberId,
    webhookToken: process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? "",
  }
}

// ---------------------------------------------------------------------------
// Tipos internos da Meta Cloud API
// ---------------------------------------------------------------------------

interface MetaMessagesResponse {
  messages?: Array<{ id: string }>
  error?: { message: string; type?: string; code?: number }
}

interface MetaMediaResponse {
  url?: string
  error?: { message: string }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit,
): Promise<{ ok: boolean; status: number; body: T }> {
  const response = await fetch(url, options)
  const body = (await response.json()) as T
  return { ok: response.ok, status: response.status, body }
}

// ---------------------------------------------------------------------------
// MetaAdapter
// ---------------------------------------------------------------------------

export class MetaAdapter implements IWhatsAppAdapter {
  constructor(private readonly config: MetaConfig) {}

  async sendText(to: string, text: string): Promise<WaSendResult> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }

    logger.debug({ to, phoneNumberId: this.config.phoneNumberId }, "whatsapp:sendText — iniciando envio")

    const { ok, status, body: responseBody } = await apiFetch<MetaMessagesResponse>(url, {
      method: "POST",
      headers: authHeaders(this.config.accessToken),
      body: JSON.stringify(body),
    })

    if (!ok || status >= 400) {
      const errorDetail = responseBody.error?.message ?? JSON.stringify(responseBody)
      logger.error({ to, status, error: errorDetail }, "whatsapp:sendText — falha na API")
      return { messageId: "", status: "failed", error: errorDetail }
    }

    const messageId = responseBody.messages?.[0]?.id ?? ""
    logger.debug({ to, messageId }, "whatsapp:sendText — mensagem enfileirada")
    return { messageId, status: "queued" }
  }

  async sendDocument(to: string, url: string, filename: string, caption?: string): Promise<WaSendResult> {
    const endpoint = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        link: url,
        filename,
        ...(caption !== undefined ? { caption } : {}),
      },
    }

    logger.debug({ to, filename }, "whatsapp:sendDocument — iniciando envio")

    const { ok, status, body: responseBody } = await apiFetch<MetaMessagesResponse>(endpoint, {
      method: "POST",
      headers: authHeaders(this.config.accessToken),
      body: JSON.stringify(body),
    })

    if (!ok || status >= 400) {
      const errorDetail = responseBody.error?.message ?? JSON.stringify(responseBody)
      logger.error({ to, filename, status, error: errorDetail }, "whatsapp:sendDocument — falha na API")
      return { messageId: "", status: "failed", error: errorDetail }
    }

    const messageId = responseBody.messages?.[0]?.id ?? ""
    logger.debug({ to, filename, messageId }, "whatsapp:sendDocument — documento enfileirado")
    return { messageId, status: "queued" }
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    logger.debug({ mediaId }, "whatsapp:downloadMedia — resolvendo URL da mídia")

    const metaUrl = `${this.config.apiUrl}/${mediaId}`
    const { ok: metaOk, status: metaStatus, body: metaBody } = await apiFetch<MetaMediaResponse>(metaUrl, {
      method: "GET",
      headers: authHeaders(this.config.accessToken),
    })

    if (!metaOk || metaStatus >= 400) {
      const detail = metaBody.error?.message ?? JSON.stringify(metaBody)
      logger.error({ mediaId, status: metaStatus, error: detail }, "whatsapp:downloadMedia — falha ao resolver URL")
      throw new Error(`downloadMedia: falha ao resolver URL da mídia ${mediaId} — ${detail}`)
    }

    const locationUrl = metaBody.url
    if (!locationUrl) {
      throw new Error(`downloadMedia: campo 'url' ausente na resposta para mídia ${mediaId}`)
    }

    const mediaResponse = await fetch(locationUrl, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    })

    if (!mediaResponse.ok) {
      throw new Error(`downloadMedia: falha ao baixar mídia ${mediaId} — HTTP ${mediaResponse.status}`)
    }

    const buffer = Buffer.from(await mediaResponse.arrayBuffer())
    logger.debug({ mediaId, bytes: buffer.length }, "whatsapp:downloadMedia — download concluído")
    return buffer
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _adapterInstance: MetaAdapter | null = null

export function getWhatsAppAdapter(): MetaAdapter {
  if (_adapterInstance === null) {
    const config = getMetaConfig()
    _adapterInstance = new MetaAdapter(config)
    logger.debug({ apiUrl: config.apiUrl, phoneNumberId: config.phoneNumberId }, "whatsapp:adapter — instância criada")
  }
  return _adapterInstance
}
