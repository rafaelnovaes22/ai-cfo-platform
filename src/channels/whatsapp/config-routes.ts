import type { FastifyPluginAsync } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { requireAuth, requireRole } from "@/auth/middleware.js"
import { logger } from "@/observability/logger.js"
import { getWhatsappConfig, updateWhatsappConfig } from "./config-service.js"
import { WhatsappConfigResponse, WhatsappConfigPatch } from "./config-schema.js"
import { verifyWhatsAppLinkToken } from "./link-token.js"

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

  // Vinculação WhatsApp ↔ conta: a página /whatsapp/auth (frontend) envia o token
  // do magic link; aqui validamos e gravamos o número no tenant logado (opt-in LGPD).
  f.post("/whatsapp/link", {
    schema: {
      body: z.object({ token: z.string().min(1).max(1000) }),
      response: { 200: WhatsappConfigResponse },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      let phone: string
      try {
        phone = await verifyWhatsAppLinkToken(req.body.token)
      } catch (err) {
        logger.warn({ err }, "whatsapp:link — token inválido/expirado")
        // Throw → errorHandler global serializa como ProblemDetail (sem schema 400 aqui).
        throw Object.assign(new Error("Link de vinculação inválido ou expirado"), { statusCode: 400 })
      }
      // Reusa updateWhatsappConfig: grava phone + enabled=true + opt-in; P2002 → 409.
      const view = await updateWhatsappConfig(req.auth!.tenantId, { phone, enabled: true })
      return reply.send(view)
    },
  })
}
