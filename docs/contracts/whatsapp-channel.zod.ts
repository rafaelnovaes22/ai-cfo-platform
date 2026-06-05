// Contrato Zod do canal WhatsApp — consumido pelo front.
// Espelha docs/contracts/whatsapp-channel.openapi.yml.
//   • Config (/config/whatsapp)        → IMPLEMENTADO no backend
//   • Messages (/whatsapp/messages)    → PLANEJADO (ADR-017); use para mock
import { z } from "zod"

// E.164: '+' + 8–15 dígitos, primeiro do país != 0.
export const E164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar no formato E.164 (ex.: +5511999998888)")

// ── Config (implementado) ───────────────────────────────────────────────────

export const WhatsappConfig = z.object({
  phone: z.string().nullable(),
  enabled: z.boolean(),
  optInAt: z.string().nullable(),
})
export type WhatsappConfig = z.infer<typeof WhatsappConfig>

export const WhatsappConfigPatch = z
  .object({
    phone: E164.nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => b.phone !== undefined || b.enabled !== undefined, {
    message: "Informe ao menos um campo: phone ou enabled",
  })
export type WhatsappConfigPatch = z.infer<typeof WhatsappConfigPatch>

// ── Messages (planejado — ADR-017) ──────────────────────────────────────────

export const WhatsappMessageStatus = z.enum([
  "sent",
  "delivered",
  "read",
  "failed",
  "skipped_disabled",
])
export const WhatsappMessageDirection = z.enum(["outbound", "inbound"])
export const WhatsappMessageKind = z.enum([
  "daily_cashflow",
  "analysis_ready",
  "reply",
  "other",
])

export const WhatsappMessage = z.object({
  id: z.string(),
  direction: WhatsappMessageDirection,
  kind: WhatsappMessageKind,
  body: z.string(),
  status: WhatsappMessageStatus,
  providerMessageId: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type WhatsappMessage = z.infer<typeof WhatsappMessage>

export const WhatsappMessageQuery = z.object({
  status: WhatsappMessageStatus.optional(),
  direction: WhatsappMessageDirection.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const WhatsappMessagePage = z.object({
  items: z.array(WhatsappMessage),
  nextCursor: z.string().nullable(),
})
export type WhatsappMessagePage = z.infer<typeof WhatsappMessagePage>
