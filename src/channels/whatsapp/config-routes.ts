import type { FastifyPluginAsync } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import { requireAuth, requireRole } from "@/auth/middleware.js"
import { defaultErrorResponses } from "@/http/problem-detail.js"
import { getWhatsappConfig, updateWhatsappConfig } from "./config-service.js"
import { WhatsappConfigResponse, WhatsappConfigPatch } from "./config-schema.js"

// Configuração do canal WhatsApp por tenant (L1 — C5).
// GET aberto a qualquer membro autenticado; PATCH restrito a admin
// (define destinatário e consentimento LGPD — operação sensível).
export const whatsappConfigRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>()

  f.get("/config/whatsapp", {
    schema: {
      response: { 200: WhatsappConfigResponse, ...defaultErrorResponses },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      return reply.send(await getWhatsappConfig(req.auth!.tenantId))
    },
  })

  f.patch("/config/whatsapp", {
    schema: {
      body: WhatsappConfigPatch,
      response: { 200: WhatsappConfigResponse, ...defaultErrorResponses },
    },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      return reply.send(await updateWhatsappConfig(req.auth!.tenantId, req.body))
    },
  })
}
