import type { FastifyPluginAsync } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { requireAuth, requireRole } from "@/auth/middleware.js"
import { listMessages } from "./message-log.js"

const StatusEnum = z.enum(["sent", "delivered", "read", "failed", "skipped_disabled"])
const DirectionEnum = z.enum(["outbound", "inbound"])
const KindEnum = z.enum(["daily_cashflow", "cashflow_from_statement", "analysis_ready", "reply", "other"])

const MessagesQuery = z.object({
  status: StatusEnum.optional(),
  direction: DirectionEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const MessageItem = z.object({
  id: z.string(),
  direction: DirectionEnum,
  kind: KindEnum,
  body: z.string(),
  status: StatusEnum,
  providerMessageId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
})

const MessagesPage = z.object({
  items: z.array(MessageItem),
  nextCursor: z.string().nullable(),
})

// Listagem de mensagens do canal WhatsApp do tenant (ADR-017).
// Inclui mensagens suprimidas por opt-out (status skipped_disabled).
// Somente admin — visibilidade operacional sobre o que foi/não foi enviado.
export const whatsappMessagesRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>()

  f.get("/whatsapp/messages", {
    schema: {
      // Sem schema de erro declarado — requireAuth/requireRole respondem { message };
      // o errorHandler global serializa erros como ProblemDetail.
      querystring: MessagesQuery,
      response: { 200: MessagesPage },
    },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const page = await listMessages({
        tenantId: req.auth!.tenantId,
        status: req.query.status,
        direction: req.query.direction,
        from: req.query.from,
        to: req.query.to,
        cursor: req.query.cursor,
        limit: req.query.limit,
      })
      return reply.send(page)
    },
  })
}
