import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { logger } from "@/observability/logger.js";
import { WaWebhookPayloadSchema, WaVerifyQuerySchema } from "./schema.js";
import { extractMessages, extractStatuses } from "./message-parser.js";
import { processMessage } from "./conversation-flow.js";
import { getSessionStore } from "./session-manager.js";
import { getWhatsAppAdapter } from "./adapter.js";

export const whatsappWebhookRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // GET /webhooks/whatsapp — verificação do webhook pelo Unnichat
  f.get("/webhooks/whatsapp", {
    schema: {
      querystring: WaVerifyQuerySchema,
      response: { 200: z.string() },
    },
    handler: async (req, reply) => {
      const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
      if (req.query["hub.verify_token"] !== verifyToken) {
        logger.warn({ url: req.url }, "whatsapp.webhook.verify.failed");
        return reply.status(403).send("Forbidden");
      }
      logger.info("whatsapp.webhook.verified");
      return reply.send(req.query["hub.challenge"]);
    },
  });

  // POST /webhooks/whatsapp — recebe eventos do Unnichat
  f.post("/webhooks/whatsapp", {
    schema: {
      body: WaWebhookPayloadSchema,
      response: { 200: z.object({ ok: z.boolean() }) },
    },
    handler: async (req, reply) => {
      const requestId = randomUUID();

      // Responde 200 imediatamente — Unnichat exige ACK rápido
      void reply.send({ ok: true });

      const messages = extractMessages(req.body);
      const statuses = extractStatuses(req.body);

      logger.info(
        { requestId, messages: messages.length, statuses: statuses.length },
        "whatsapp.webhook.received"
      );

      const sessionStore = getSessionStore();
      const adapter = getWhatsAppAdapter();

      // Processa cada mensagem de forma assíncrona (não bloqueia o ACK)
      for (const msg of messages) {
        processMessage(msg, { sessionStore, adapter }).catch((err) => {
          logger.error({ requestId, from: msg.from, err }, "whatsapp.message.process.error");
        });
      }

      for (const status of statuses) {
        logger.info({ requestId, messageId: status.messageId, status: status.status }, "whatsapp.status.update");
      }
    },
  });
};
