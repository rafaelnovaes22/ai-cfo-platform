import type { FastifyPluginAsync } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import { requireAuth, requireRole } from "@/auth/middleware.js"
import { getWhatsappConfig, updateWhatsappConfig } from "./config-service.js"
import { WhatsappConfigResponse, WhatsappConfigPatch } from "./config-schema.js"

// Configuração do canal WhatsApp por tenant (L1 — C5).
// GET aberto a qualquer membro autenticado; PATCH restrito a admin
// (define destinatário e consentimento LGPD — operação sensível).
export const whatsappConfigRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>()

  f.get("/config/whatsapp", {
    schema: {
      // Sem schema de erro declarado: requireAuth/requireRole respondem { message }
      // e o errorHandler global serializa erros como ProblemDetail. Declarar
      // 401/403 como ProblemDetail aqui quebraria a serialização do { message }.
      response: { 200: WhatsappConfigResponse },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      return reply.send(await getWhatsappConfig(req.auth!.tenantId))
    },
  })

  f.patch("/config/whatsapp", {
    schema: {
      body: WhatsappConfigPatch,
      response: { 200: WhatsappConfigResponse },
    },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      return reply.send(await updateWhatsappConfig(req.auth!.tenantId, req.body))
    },
  })
}
