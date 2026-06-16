// ingest-handler.ts — whatsapp-channel
// Recebe um documento enviado via WhatsApp (PDF, XLSX, CSV), faz download do
// media pelo adapter e repassa ao módulo de ingest existente do Aicfo.
// C7 — acoplado somente via IWhatsAppAdapter; troca de provider = nova classe, zero mudança aqui.
// C8 — tenantId sempre resolvido em runtime; nenhum hardcode.

import os from "node:os"
import path from "node:path"
import fs from "node:fs/promises"
import { ingest } from "@/ingest/service.js"
import { logger } from "@/observability/logger.js"
import type { WaIncomingMessage, IWhatsAppAdapter } from "./types.js"
import type { IngestSource } from "@/ingest/service.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deriva o IngestSource a partir do MIME type do documento.
 * PDF → "pdf" | XLSX/XLS → "excel" | CSV → "csv"
 * Retorna null para MIME types não suportados.
 */
function mimeToSource(mimeType: string): IngestSource | null {
  if (mimeType === "application/pdf") return "pdf"
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  )
    return "excel"
  if (mimeType === "text/csv") return "csv"
  return null
}

/**
 * Retorna o mês atual no formato YYYY-MM.
 */
function currentReferenceMonth(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  return `${yyyy}-${mm}`
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Processa um documento recebido via WhatsApp e o injeta no pipeline de ingest
 * do Aicfo.
 *
 * Fluxo:
 *   1. Valida que a mensagem contém um documento com MIME type suportado.
 *   2. Faz download do media via `adapter.downloadMedia`.
 *   3. Grava o buffer em arquivo temporário (necessário para parsers baseados
 *      em path — ex.: pdf-parse, xlsx).
 *   4. Chama `ingest()` com o buffer e o mês de referência atual.
 *   5. Limpa o arquivo temporário e retorna o resultado.
 *
 * @returns `{ analysisId, entryCount }` em sucesso ou `{ error }` em falha.
 */
export async function handleIngestDocument(
  msg: WaIncomingMessage,
  tenantId: string,
  adapter: IWhatsAppAdapter,
  opts: { skipAnalysis?: boolean } = {},
): Promise<{ analysisId: string; entryCount: number; referenceMonth: string; startDate?: string; endDate?: string } | { error: string }> {
  // 1. Validações iniciais
  if (msg.type !== "document" || !msg.document) {
    logger.warn({ tenantId, messageId: msg.messageId }, "whatsapp:ingest — mensagem sem documento")
    return { error: "Mensagem não contém documento." }
  }

  const { id: mediaId, filename, mimeType } = msg.document
  const source = mimeToSource(mimeType)

  if (source === null) {
    logger.warn(
      { tenantId, messageId: msg.messageId, mimeType },
      "whatsapp:ingest — MIME type não suportado",
    )
    return { error: `Formato não suportado: ${mimeType}. Envie PDF, XLSX ou CSV.` }
  }

  const referenceMonth = currentReferenceMonth()

  logger.info(
    { tenantId, mediaId, filename, mimeType, source, referenceMonth },
    "whatsapp:ingest — iniciando download do documento",
  )

  // 2. Download do buffer
  let buffer: Buffer
  try {
    buffer = await adapter.downloadMedia(mediaId)
  } catch (err) {
    logger.error(
      { tenantId, mediaId, err },
      "whatsapp:ingest — falha no download do media",
    )
    return { error: "Não foi possível baixar o arquivo. Tente novamente." }
  }

  // 3. Gravar em arquivo temporário (alguns parsers exigem path em disco)
  const ext = path.extname(filename) || `.${source}`
  const tmpPath = path.join(os.tmpdir(), `aicfo-wa-${tenantId}-${Date.now()}${ext}`)

  try {
    await fs.writeFile(tmpPath, buffer)
  } catch (err) {
    logger.error(
      { tenantId, tmpPath, err },
      "whatsapp:ingest — falha ao gravar arquivo temporário",
    )
    return { error: "Erro interno ao preparar o arquivo para processamento." }
  }

  // 4. Chamar ingest service
  let analysisId: string
  let entryCount: number
  let resultReferenceMonth: string
  let resultStartDate: string | undefined
  let resultEndDate: string | undefined

  try {
    const result = await ingest({
      tenantId,
      referenceMonth,
      source,
      buffer,
      skipAnalysis: opts.skipAnalysis,
    })

    if (result.outcome === "failed") {
      logger.warn(
        { tenantId, referenceMonth, source, result },
        "whatsapp:ingest — ingest retornou outcome=failed",
      )
      // Fluxo cash-flow-only (aluno) com PDF sem lançamentos: provavelmente é uma
      // DRE, não um extrato. Orienta a enviar o extrato (sem disparar o LLM da DRE).
      if (result.entryCount === 0 && source === "pdf" && opts.skipAnalysis) {
        return {
          error:
            "📄 Isso parece uma DRE, não um extrato bancário. Aqui eu calculo o " +
            "*fluxo de caixa* a partir do seu *extrato* (PDF, Excel ou CSV). " +
            "Me envie o extrato da conta que eu te devolvo o caixa na hora.",
        }
      }
      return {
        error:
          result.entryCount === 0
            ? "Nenhum lançamento encontrado no arquivo. Verifique o formato e tente novamente."
            : "Não foi possível processar os lançamentos. Verifique o arquivo.",
      }
    }

    analysisId = result.analysisId
    entryCount = result.entryCount
    resultReferenceMonth = result.referenceMonth
    resultStartDate = result.startDate
    resultEndDate = result.endDate
  } catch (err) {
    logger.error(
      { tenantId, referenceMonth, source, err },
      "whatsapp:ingest — exceção no ingest service",
    )
    return { error: "Erro interno ao processar o arquivo. Tente novamente em instantes." }
  } finally {
    // 5. Limpar arquivo temporário em qualquer caso
    await fs.unlink(tmpPath).catch((unlinkErr) => {
      logger.warn(
        { tmpPath, err: unlinkErr },
        "whatsapp:ingest — falha ao remover arquivo temporário (não crítico)",
      )
    })
  }

  logger.info(
    { tenantId, analysisId, entryCount, referenceMonth },
    "whatsapp:ingest — documento processado com sucesso",
  )

  return { analysisId, entryCount, referenceMonth: resultReferenceMonth, startDate: resultStartDate, endDate: resultEndDate }
}
