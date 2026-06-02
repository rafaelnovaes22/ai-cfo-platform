// Deduplicação de mensagens do webhook do WhatsApp.
// A Meta reentrega o webhook quando o ACK demora ou por entrega-ao-menos-uma-vez,
// então o mesmo messageId pode chegar mais de uma vez. Sem dedup, a mesma
// mensagem é processada 2x (ingest duplicado, resposta duplicada).
//
// Estratégia: SET NX EX atômico por messageId. O primeiro a reivindicar processa;
// os demais são ignorados. Em falha de processamento, libera-se a chave para que
// a reentrega da Meta consiga reprocessar.

import type IORedis from "ioredis"
import { getRedis } from "./session-manager.js"
import { logger } from "@/observability/logger.js"

const DEDUP_KEY_PREFIX = "whatsapp:dedup:"
// 24h cobre a janela de reentrega da Meta com folga.
const DEDUP_TTL_SECONDS = 24 * 60 * 60

/**
 * Reivindica o processamento de um messageId de forma atômica.
 * @returns "new" se foi o primeiro a reivindicar; "duplicate" caso já exista.
 *
 * Fail-open: se o Redis falhar, retorna "new" e loga — preferimos processar uma
 * possível duplicata a perder a mensagem (dedup é robustez, não segurança).
 */
export async function claimMessage(
  messageId: string,
  redis: IORedis = getRedis(),
): Promise<"new" | "duplicate"> {
  if (!messageId) return "new"
  try {
    const result = await redis.set(`${DEDUP_KEY_PREFIX}${messageId}`, "1", "EX", DEDUP_TTL_SECONDS, "NX")
    return result === "OK" ? "new" : "duplicate"
  } catch (err) {
    logger.error({ err, messageId }, "whatsapp.dedup — erro no Redis; processando sem dedup (fail-open)")
    return "new"
  }
}

/**
 * Libera a reivindicação de um messageId — usado quando o processamento falha,
 * para que a reentrega da Meta consiga reprocessar a mensagem.
 */
export async function releaseMessage(
  messageId: string,
  redis: IORedis = getRedis(),
): Promise<void> {
  if (!messageId) return
  try {
    await redis.del(`${DEDUP_KEY_PREFIX}${messageId}`)
  } catch (err) {
    logger.warn({ err, messageId }, "whatsapp.dedup — falha ao liberar messageId após erro de processamento")
  }
}
