import { z } from "zod"

// E.164: '+' seguido de 8–15 dígitos, primeiro dígito do país != 0.
// Ex.: +5511999998888
const E164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar no formato E.164 (ex.: +5511999998888)")

// Resposta do GET /config/whatsapp — estado atual do canal para o tenant.
// `phone` pode vir pré-preenchido pelo /register (campo opcional) ou null
// quando o tenant ainda não informou destinatário.
export const WhatsappConfigResponse = z.object({
  phone: z.string().nullable(),
  enabled: z.boolean(),
  // Timestamp do opt-in explícito (LGPD Art. 7). null = consentimento nunca registrado.
  optInAt: z.string().nullable(),
})

// Body do PATCH /config/whatsapp — campos opcionais (atualização parcial).
// `phone: null` permite limpar o destinatário; omitir mantém o valor atual.
export const WhatsappConfigPatch = z
  .object({
    phone: E164.nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => b.phone !== undefined || b.enabled !== undefined, {
    message: "Informe ao menos um campo: phone ou enabled",
  })

export type WhatsappConfigPatchInput = z.infer<typeof WhatsappConfigPatch>
