// notification-service.ts — whatsapp-channel
// Envia notificações proativas aos tenants via WhatsApp:
//   • Resumo diário de caixa (chamado pelo BullMQ job às 08:00)
//   • Alerta de análise mensal pronta (chamado pelo pipeline monthly-analysis)
// C7 — acoplado somente via IWhatsAppAdapter; troca de provider = nova classe.
// C8 — nenhum tenantId hardcoded; config de notificações lida do productConfig do tenant.

import { getPrisma } from "@/persistence/prisma.js"
import { getCashflowSummaryDay } from "@/cashflow/service.js"
import { formatCashflowSummary, formatAnalysisReady } from "./response-formatter.js"
import { logOutbound, logSkipped } from "./message-log.js"
import { logger } from "@/observability/logger.js"
import { storePassiveContext } from "./conversation-graph/passive-context.js"
import type { IWhatsAppAdapter } from "./types.js"
import { randomUUID } from "node:crypto"

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (fuso local do processo).
 */
function todayIso(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Lê o flag `whatsapp.notificationsEnabled` do productConfig do tenant.
 * Default: true quando a chave está ausente (opt-out explícito necessário).
 */
function notificationsEnabled(productConfig: unknown): boolean {
  if (
    productConfig !== null &&
    typeof productConfig === "object" &&
    "whatsapp" in productConfig
  ) {
    const wa = (productConfig as Record<string, unknown>)["whatsapp"]
    if (wa !== null && typeof wa === "object" && "notificationsEnabled" in wa) {
      return (wa as Record<string, unknown>)["notificationsEnabled"] !== false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Envia resumo diário de caixa para UM tenant.
 * Chamado pelo job agendado (BullMQ) às 08:00 — um job por tenant.
 *
 * Lança exceção se o envio falhar para que o caller (BullMQ) possa
 * recolocar o job na fila ou registrar o erro.
 */
export async function sendDailyCashflowSummary(
  tenantId: string,
  adapter: IWhatsAppAdapter,
): Promise<void> {
  const db = getPrisma()

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      whatsappPhone: true,
      whatsappEnabled: true,
      productConfig: true,
    },
  })

  if (!tenant) {
    logger.warn({ tenantId }, "whatsapp:notification — tenant não encontrado")
    return
  }

  if (!tenant.whatsappEnabled || !tenant.whatsappPhone) {
    logger.debug(
      { tenantId, whatsappEnabled: tenant.whatsappEnabled },
      "whatsapp:notification — WhatsApp não habilitado para o tenant; ignorando",
    )
    await logSkipped({ tenantId, kind: "daily_cashflow" })
    return
  }

  if (!notificationsEnabled(tenant.productConfig)) {
    logger.debug(
      { tenantId },
      "whatsapp:notification — notificações desabilitadas pelo tenant; ignorando",
    )
    await logSkipped({ tenantId, kind: "daily_cashflow" })
    return
  }

  const date = todayIso()
  const requestId = randomUUID()

  const summary = await getCashflowSummaryDay({ tenantId, date, requestId })
  const text = formatCashflowSummary(summary)

  const result = await adapter.sendText(tenant.whatsappPhone, text)
  await logOutbound({ tenantId, kind: "daily_cashflow", body: text, result })
  if (result.status === "queued") {
    await storePassiveContext({
      phoneE164: tenant.whatsappPhone,
      tenantId,
      source: "daily_cashflow",
      summary: "Resumo diário de caixa enviado.",
    })
  }

  logger.info(
    { tenantId, date, status: result.status, messageId: result.messageId },
    "whatsapp:notification — resumo diário enviado",
  )

  if (result.status === "failed") {
    throw new Error(
      `whatsapp:sendDailyCashflowSummary falhou para tenant ${tenantId}: ${result.error ?? "erro desconhecido"}`,
    )
  }
}

/**
 * Envia notificação de análise pronta para UM tenant.
 * Chamado pelo pipeline monthly-analysis quando o status muda para "ready".
 *
 * Não lança exceção em caso de falha de envio — a análise já foi gerada;
 * o erro é logado e o fluxo continua normalmente.
 */
export async function notifyAnalysisReady(
  tenantId: string,
  referenceMonth: string,
  adapter: IWhatsAppAdapter,
): Promise<void> {
  const db = getPrisma()

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      whatsappPhone: true,
      whatsappEnabled: true,
      productConfig: true,
    },
  })

  if (!tenant) {
    logger.warn({ tenantId }, "whatsapp:notification — tenant não encontrado para notifyAnalysisReady")
    return
  }

  if (!tenant.whatsappEnabled || !tenant.whatsappPhone) {
    logger.debug(
      { tenantId, whatsappEnabled: tenant.whatsappEnabled },
      "whatsapp:notification — WhatsApp não habilitado; ignorando notifyAnalysisReady",
    )
    await logSkipped({ tenantId, kind: "analysis_ready" })
    return
  }

  if (!notificationsEnabled(tenant.productConfig)) {
    logger.debug(
      { tenantId },
      "whatsapp:notification — notificações desabilitadas; ignorando notifyAnalysisReady",
    )
    await logSkipped({ tenantId, kind: "analysis_ready" })
    return
  }

  const text = formatAnalysisReady(referenceMonth)
  const result = await adapter.sendText(tenant.whatsappPhone, text)
  await logOutbound({ tenantId, kind: "analysis_ready", body: text, result })
  if (result.status === "queued") {
    await storePassiveContext({
      phoneE164: tenant.whatsappPhone,
      tenantId,
      source: "analysis_ready",
      summary: `Análise mensal de ${referenceMonth} pronta para consulta.`,
    })
  }

  logger.info(
    { tenantId, referenceMonth, status: result.status, messageId: result.messageId },
    "whatsapp:notification — análise pronta notificada",
  )

  if (result.status === "failed") {
    // Não relança — a análise já foi gerada com sucesso; falha de notificação
    // não deve reverter o outcome do pipeline.
    logger.error(
      { tenantId, referenceMonth, error: result.error },
      "whatsapp:notification — falha ao enviar notifyAnalysisReady (não crítico)",
    )
  }
}

/**
 * Envia resumo diário de caixa para TODOS os tenants com WhatsApp ativo e
 * notificações habilitadas.
 * Chamado pelo BullMQ job diário às 08:00.
 *
 * Erros individuais são capturados e logados — a falha de um tenant não
 * interrompe o envio para os demais.
 */
export async function sendDailyCashflowToAll(adapter: IWhatsAppAdapter): Promise<void> {
  const db = getPrisma()

  // Notificações proativas são business-initiated (cobradas pela Meta).
  // Plano student usa free tier Meta — só mensagens iniciadas pelo aluno.
  const tenants = await db.tenant.findMany({
    where: {
      whatsappEnabled: true,
      whatsappPhone: { not: null },
      subscriptions: {
        some: { plan: { not: "student" } },
      },
    },
    select: {
      id: true,
      whatsappPhone: true,
      productConfig: true,
    },
  })

  logger.info({ count: tenants.length }, "whatsapp:notification — iniciando envio diário em massa")

  const date = todayIso()

  const results = await Promise.allSettled(
    tenants.map(async (tenant) => {
      // Verificar notificações habilitadas por tenant antes de buscar dados
      if (!notificationsEnabled(tenant.productConfig)) {
        logger.debug(
          { tenantId: tenant.id },
          "whatsapp:notification — notificações desabilitadas; pulando",
        )
        await logSkipped({ tenantId: tenant.id, kind: "daily_cashflow" })
        return
      }

      const requestId = randomUUID()

      try {
        const summary = await getCashflowSummaryDay({
          tenantId: tenant.id,
          date,
          requestId,
        })
        const text = formatCashflowSummary(summary)

        // whatsappPhone nunca é null aqui (filtrado pela query acima)
        const result = await adapter.sendText(tenant.whatsappPhone!, text)
        await logOutbound({ tenantId: tenant.id, kind: "daily_cashflow", body: text, result })
        if (result.status === "queued") {
          await storePassiveContext({
            phoneE164: tenant.whatsappPhone!,
            tenantId: tenant.id,
            source: "daily_cashflow",
            summary: "Resumo diário de caixa enviado.",
          })
        }

        logger.info(
          { tenantId: tenant.id, date, status: result.status, messageId: result.messageId },
          "whatsapp:notification — resumo diário enviado",
        )
      } catch (err) {
        logger.error(
          { tenantId: tenant.id, date, err },
          "whatsapp:notification — falha ao enviar resumo diário para tenant",
        )
        await logOutbound({
          tenantId: tenant.id,
          kind: "daily_cashflow",
          body: "",
          result: { messageId: "", status: "failed", error: (err as Error).message },
        })
      }
    }),
  )

  const failed = results.filter((r) => r.status === "rejected").length
  const succeeded = results.length - failed

  logger.info(
    { total: results.length, succeeded, failed },
    "whatsapp:notification — envio diário em massa concluído",
  )
}
