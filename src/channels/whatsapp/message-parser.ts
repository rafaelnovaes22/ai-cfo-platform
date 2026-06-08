// message-parser.ts — whatsapp-channel
// Transforma o payload bruto do webhook Unnichat em tipos internos e classifica comandos.
// C7: depende somente de tipos internos (WaIncomingMessage, WaStatusUpdate); zero acoplamento ao SDK Meta.
// C8: nenhum tenantId hardcoded.

import type { WaWebhookPayload } from "./schema.js"
import type { WaIncomingMessage, WaMessageType, WaStatusUpdate } from "./types.js"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type WaCommand =
  | "MENU"     // "menu", "ajuda", "oi", "olá", "ola", "hello"
  | "CAIXA"    // "caixa", "hoje", "saldo"
  | "SEMANA"   // "semana", "semana passada", "7 dias"
  | "ANALISE"  // "analise", "análise", "análise mensal", "relatorio"
  | "STATUS"   // "status", "como estou"
  | "UNKNOWN"  // qualquer outro texto

// ---------------------------------------------------------------------------
// Mapa de palavras-chave → WaCommand (já normalizadas: lowercase + sem acentos)
// ---------------------------------------------------------------------------

const COMMAND_MAP: ReadonlyArray<readonly [WaCommand, ReadonlyArray<string>]> = [
  ["MENU",    ["menu", "ajuda", "oi", "ola", "hello"]],
  ["CAIXA",   ["caixa", "hoje", "saldo"]],
  ["SEMANA",  ["semana", "semana passada", "7 dias"]],
  ["ANALISE", ["analise", "relatorio"]],
  ["STATUS",  ["status", "como estou"]],
]

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
])

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Converte epoch-string (segundos) ou ISO-8601 para ISO-8601. */
function toIso(timestamp: string): string {
  // Unnichat/Meta envia epoch em segundos como string numérica
  if (/^\d+$/.test(timestamp)) {
    return new Date(parseInt(timestamp, 10) * 1000).toISOString()
  }
  return timestamp
}

/** Mapeia o type (string livre) do schema Meta para WaMessageType interno. */
const KNOWN_MESSAGE_TYPES = new Set<WaMessageType>([
  "text", "document", "image", "audio", "interactive", "unknown",
])
function mapMessageType(rawType: string): WaMessageType {
  if (rawType === "button") return "button_reply"
  return KNOWN_MESSAGE_TYPES.has(rawType as WaMessageType) ? (rawType as WaMessageType) : "unknown"
}

const KNOWN_STATUSES = new Set(["sent", "delivered", "read", "failed"])

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Extrai todas as mensagens de entrada presentes no payload do webhook.
 * Percorre entry[*].changes[*].value.messages[*] e converte cada item
 * para WaIncomingMessage, mapeando os campos snake_case do schema Meta
 * para o contrato interno camelCase.
 */
export function extractMessages(payload: WaWebhookPayload): WaIncomingMessage[] {
  const messages: WaIncomingMessage[] = []

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const rawMessages = change.value.messages
      if (!rawMessages) continue

      for (const raw of rawMessages) {
        const msg: WaIncomingMessage = {
          messageId: raw.id,
          from: raw.from,
          timestamp: toIso(raw.timestamp),
          type: mapMessageType(raw.type),
        }

        if (raw.text) {
          msg.text = raw.text.body
        }

        if (raw.document) {
          msg.document = {
            id: raw.document.id,
            filename: raw.document.filename ?? "",
            mimeType: raw.document.mime_type,
            ...(raw.document.caption !== undefined && { caption: raw.document.caption }),
          }
        }

        if (raw.image) {
          msg.image = {
            id: raw.image.id,
            mimeType: raw.image.mime_type,
            ...(raw.image.caption !== undefined && { caption: raw.image.caption }),
          }
        }

        // interactive com button_reply
        if (raw.interactive?.button_reply) {
          msg.type = "button_reply"
          msg.buttonReply = {
            id: raw.interactive.button_reply.id,
            title: raw.interactive.button_reply.title,
          }
        }

        messages.push(msg)
      }
    }
  }

  return messages
}

/**
 * Extrai todos os status updates presentes no payload do webhook.
 * Percorre entry[*].changes[*].value.statuses[*].
 */
export function extractStatuses(payload: WaWebhookPayload): WaStatusUpdate[] {
  const statuses: WaStatusUpdate[] = []

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const rawStatuses = change.value.statuses
      if (!rawStatuses) continue

      for (const raw of rawStatuses) {
        // Ignora status desconhecidos (schema agora aceita string livre).
        if (!KNOWN_STATUSES.has(raw.status)) continue
        statuses.push({
          messageId: raw.id,
          from: raw.recipient_id,
          status: raw.status as WaStatusUpdate["status"],
          timestamp: toIso(raw.timestamp),
        })
      }
    }
  }

  return statuses
}

/**
 * Classifica texto livre em WaCommand.
 * Normalização: trim → lowercase → remove diacríticos (NFD + strip Mn).
 * Match: verifica se alguma palavra-chave é igual ao texto normalizado;
 * para frases multi-palavra verifica se o texto começa com a chave.
 * Retorna UNKNOWN se nenhuma categoria encaixar.
 */
// Seleção numérica do menu (formatWelcomeMenu). Match exato para não confundir
// com valores numéricos colados. Mantido em sincronia com a numeração do menu.
const NUMERIC_MENU: Readonly<Record<string, WaCommand>> = {
  "1": "CAIXA",
  "2": "SEMANA",
  "3": "ANALISE",
}

export function classifyCommand(text: string): WaCommand {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")

  // Usuário respondeu com o número da opção do menu.
  const numeric = NUMERIC_MENU[normalized]
  if (numeric) return numeric

  for (const [command, keywords] of COMMAND_MAP) {
    for (const kw of keywords) {
      // Palavra única: igualdade exata; frase: starts-with + boundary
      if (kw === normalized) return command
      if (normalized.startsWith(kw + " ") || normalized.startsWith(kw + "\t")) {
        return command
      }
    }
  }

  return "UNKNOWN"
}

/**
 * Verifica se uma mensagem é um documento suportado para ingest.
 * Formatos aceitos: PDF, XLSX, XLS, CSV.
 */
export function isSupportedDocument(msg: WaIncomingMessage): boolean {
  if (msg.type !== "document") return false
  if (!msg.document) return false
  return SUPPORTED_MIME_TYPES.has(msg.document.mimeType)
}
