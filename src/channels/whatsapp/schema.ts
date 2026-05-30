import { z } from "zod"

// Payload do webhook Unnichat (entrada do POST /webhooks/whatsapp)
// Unnichat usa formato compatível com Meta Cloud API
export const WaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal("whatsapp"),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z
              .array(
                z.object({
                  profile: z.object({ name: z.string() }),
                  wa_id: z.string(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  id: z.string(),
                  from: z.string(),
                  timestamp: z.string(),
                  type: z.enum([
                    "text",
                    "document",
                    "image",
                    "audio",
                    "interactive",
                    "button",
                    "unknown",
                  ]),
                  text: z.object({ body: z.string() }).optional(),
                  document: z
                    .object({
                      id: z.string(),
                      filename: z.string().optional(),
                      mime_type: z.string(),
                      caption: z.string().optional(),
                    })
                    .optional(),
                  image: z
                    .object({
                      id: z.string(),
                      mime_type: z.string(),
                      caption: z.string().optional(),
                    })
                    .optional(),
                  interactive: z
                    .object({
                      type: z.string(),
                      button_reply: z
                        .object({ id: z.string(), title: z.string() })
                        .optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  recipient_id: z.string(),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  timestamp: z.string(),
                }),
              )
              .optional(),
          }),
          field: z.string(),
        }),
      ),
    }),
  ),
})

// Query params do GET /webhooks/whatsapp (verificação do webhook Unnichat)
export const WaVerifyQuerySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string(),
})

export type WaWebhookPayload = z.infer<typeof WaWebhookPayloadSchema>
