// Verificação de autenticidade do webhook do WhatsApp (Meta Cloud API).
// A Meta assina o corpo bruto de cada POST com HMAC-SHA256 usando o App Secret
// e envia o resultado no header `X-Hub-Signature-256: sha256=<hex>`.
// Sem esta verificação, qualquer um que descubra a URL pode forjar mensagens.
//
// Fail-closed: ausência de secret, de corpo bruto ou de assinatura → inválido.

import { createHmac, timingSafeEqual } from "node:crypto"
import { logger } from "@/observability/logger.js"

const SIGNATURE_PREFIX = "sha256="

/**
 * Valida o header `X-Hub-Signature-256` contra o HMAC-SHA256 do corpo bruto.
 *
 * @param rawBody  bytes exatos recebidos (Buffer) — re-serializar o JSON quebra o HMAC.
 * @param signatureHeader  valor do header, esperado no formato "sha256=<hex>".
 * @param appSecret  META_APP_SECRET (App Secret do app Meta).
 * @returns true somente se a assinatura conferir; false em qualquer outro caso.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) {
    // Erro de configuração nosso — rejeita por segurança em vez de aceitar sem verificar.
    logger.error("whatsapp.webhook.signature — META_APP_SECRET ausente; rejeitando (fail-closed)")
    return false
  }
  if (!rawBody || rawBody.length === 0 || !signatureHeader) {
    logger.warn("whatsapp.webhook.signature — corpo bruto ou header de assinatura ausente")
    return false
  }
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    logger.warn("whatsapp.webhook.signature — formato de assinatura inesperado")
    return false
  }

  const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length)
  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex")

  // timingSafeEqual exige buffers de mesmo tamanho. Comparar os digests decodificados
  // (32 bytes do sha256) evita vazar informação por tempo de comparação.
  const receivedBuf = Buffer.from(receivedHex, "hex")
  const expectedBuf = Buffer.from(expectedHex, "hex")
  if (receivedBuf.length !== expectedBuf.length || receivedBuf.length === 0) {
    return false
  }
  return timingSafeEqual(receivedBuf, expectedBuf)
}
