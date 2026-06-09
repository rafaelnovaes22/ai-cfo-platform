import type { WaIncomingMessage } from "../types.js"
import { isSupportedDocument } from "../message-parser.js"
import type { WaConversationState, WaIntent } from "./state.js"
import { rawTextFromMessage } from "./state.js"

export interface WaIntentClassification {
  intent: WaIntent
  confidence: "high" | "medium" | "low"
  requiresSlm: boolean
  normalizedText: string
}

export function normalizeWhatsappText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text === term || text.includes(term))
}

export function classifyWaIntent(
  msg: WaIncomingMessage,
  conversation?: WaConversationState | null,
): WaIntentClassification {
  if (isSupportedDocument(msg)) {
    return { intent: "DOCUMENT_RECEIVED", confidence: "high", requiresSlm: false, normalizedText: "" }
  }

  const normalizedText = normalizeWhatsappText(rawTextFromMessage(msg))

  if (!normalizedText) {
    return { intent: "UNKNOWN", confidence: "low", requiresSlm: false, normalizedText }
  }

  if (["1", "2", "3"].includes(normalizedText)) {
    const intent: WaIntent = normalizedText === "3" ? "ASK_MONTHLY_ANALYSIS" : "ASK_CASHFLOW"
    return { intent, confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["humano", "atendente", "suporte", "falar com alguem"])) {
    return { intent: "HUMAN_SUPPORT", confidence: "high", requiresSlm: false, normalizedText }
  }

  // Pergunta sobre o que o bot faz / como se fala com ele. Vem antes de GREETING e
  // SEND_STATEMENT_HELP para "como funciona"/"como interajo"/"o que voce faz" não
  // caírem no fallback genérico (que só repetia o pedido de extrato).
  if (
    includesAny(normalizedText, [
      "como funciona",
      "como interajo",
      "como interagir",
      "interagir com voce",
      "interagir",
      "como uso",
      "como usar",
      "como te uso",
      "como utilizo",
      "como utilizar",
      "o que voce faz",
      "o que voce pode",
      "o que da pra fazer",
      "o que da para fazer",
      "pra que serve",
      "para que serve",
      "como falar com voce",
      "como converso com voce",
      "quem e voce",
      "o que e o aicfo",
    ])
  ) {
    return { intent: "CAPABILITIES_HELP", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (["sim", "ok", "pode", "claro", "vamos", "continuar"].includes(normalizedText)) {
    return { intent: "CONFIRMATION", confidence: "medium", requiresSlm: false, normalizedText }
  }

  if (["nao", "agora nao", "depois"].includes(normalizedText)) {
    return { intent: "NEGATION", confidence: "medium", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["oi", "ola", "bom dia", "boa tarde", "boa noite", "menu", "ajuda"])) {
    return { intent: "GREETING", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["extrato", "arquivo", "pdf", "excel", "csv", "planilha", "como envio", "enviar"])) {
    return { intent: "SEND_STATEMENT_HELP", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["fluxo", "caixa", "saldo", "entrada", "saida", "recebimento", "pagamento"])) {
    return { intent: "ASK_CASHFLOW", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["continua", "continuar", "e agora", "agora?", "proximo", "o que faco"])) {
    return { intent: "ASK_NEXT_STEP", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["analise", "mensal", "mes", "dre", "relatorio"])) {
    return { intent: "ASK_MONTHLY_ANALYSIS", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["status", "minha conta", "plano", "ativo", "vinculado"])) {
    return { intent: "ASK_STATUS", confidence: "high", requiresSlm: false, normalizedText }
  }

  if (includesAny(normalizedText, ["explica", "explique", "por que", "porque", "isso esta bom", "o que acha", "recomenda"])) {
    return {
      intent: "EXPLAIN_LAST_OUTCOME",
      confidence: conversation?.lastOutcome || conversation?.passiveContext ? "high" : "medium",
      requiresSlm: Boolean(conversation?.lastOutcome || conversation?.passiveContext),
      normalizedText,
    }
  }

  return { intent: "UNKNOWN", confidence: "low", requiresSlm: false, normalizedText }
}
