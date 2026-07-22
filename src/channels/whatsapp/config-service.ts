// config-service.ts — whatsapp-channel
// Leitura e atualização da configuração do canal WhatsApp por tenant:
//   • phone   — número destinatário E.164 (whatsappPhone)
//   • enabled — liga/desliga envio proativo (whatsappEnabled)
//   • optInAt — timestamp do consentimento explícito (whatsappOptInAt, LGPD Art. 7)
// C8 — nenhum tenantId hardcoded; estado lido/gravado em colunas dedicadas do Tenant.

import { Prisma } from "@prisma/client"
import { getPrisma } from "@/persistence/prisma.js"
import type { WhatsappConfigPatchInput } from "./config-schema.js"

export interface WhatsappConfigView {
  phone: string | null
  enabled: boolean
  optInAt: string | null
}

function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

export async function getWhatsappConfig(tenantId: string): Promise<WhatsappConfigView> {
  const db = getPrisma()
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { whatsappPhone: true, whatsappEnabled: true, whatsappOptInAt: true },
  })
  return {
    phone: tenant.whatsappPhone,
    enabled: tenant.whatsappEnabled,
    optInAt: tenant.whatsappOptInAt?.toISOString() ?? null,
  }
}

export async function updateWhatsappConfig(
  tenantId: string,
  patch: WhatsappConfigPatchInput,
): Promise<WhatsappConfigView> {
  const db = getPrisma()
  const current = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { whatsappPhone: true, whatsappEnabled: true, whatsappOptInAt: true },
  })

  const nextPhone = patch.phone !== undefined ? patch.phone : current.whatsappPhone
  const nextEnabled = patch.enabled !== undefined ? patch.enabled : current.whatsappEnabled

  // Não é possível habilitar o envio sem um destinatário configurado.
  if (nextEnabled && !nextPhone) {
    throw httpError("Defina o telefone (phone) antes de habilitar o envio", 400)
  }

  // LGPD Art. 7 — carimba o consentimento sempre que o tenant habilita o envio.
  // O ato de habilitar (com um número informado) é o registro explícito do opt-in.
  // Ao desabilitar, preserva o optInAt histórico (registro de quando consentiu).
  const data: {
    whatsappPhone?: string | null
    whatsappEnabled?: boolean
    whatsappOptInAt?: Date
  } = {}
  if (patch.phone !== undefined) data.whatsappPhone = patch.phone
  if (patch.enabled !== undefined) data.whatsappEnabled = patch.enabled
  if (patch.enabled === true) data.whatsappOptInAt = new Date()

  let updated
  try {
    updated = await db.tenant.update({
      where: { id: tenantId },
      data,
      select: { whatsappPhone: true, whatsappEnabled: true, whatsappOptInAt: true },
    })
  } catch (err) {
    // Número já vinculado a outro tenant (índice único whatsappPhone).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw httpError("Este número de WhatsApp já está vinculado a outra conta", 409)
    }
    throw err
  }

  return {
    phone: updated.whatsappPhone,
    enabled: updated.whatsappEnabled,
    optInAt: updated.whatsappOptInAt?.toISOString() ?? null,
  }
}
