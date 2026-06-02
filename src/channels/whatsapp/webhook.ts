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
import { verifyMetaSignature } from "./signature.js";
import { claimMessage, releaseMessage } from "./dedup.js";

export const whatsappWebhookRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // GET /webhooks/whatsapp — verificação do webhook pelo Unnichat
  f.get("/webhooks/whatsapp", {
    schema: {
      querystring: WaVerifyQuerySchema,
      response: { 200: z.string(), 403: z.string() },
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

  // POST /webhooks/whatsapp — recebe eventos do WhatsApp (Meta Cloud API)
  // config.rawBody: fastify-raw-body preserva os bytes originais para o HMAC.
  // config.rateLimit=false: o limite global é por-IP, mas todo webhook chega do
  // MESMO IP da Meta — limitar por-IP bloquearia tráfego legítimo de todos os
  // usuários ao mesmo tempo. A proteção real aqui é a assinatura (forjados → 401
  // barato) + a dedup; por-IP não se aplica.
  f.post("/webhooks/whatsapp", {
    config: { rawBody: true, rateLimit: false },
    schema: {
      body: WaWebhookPayloadSchema,
      response: {
        200: z.object({ ok: z.boolean() }),
        401: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      // Autenticação: valida HMAC-SHA256 do corpo bruto contra X-Hub-Signature-256.
      // Sem isso, qualquer um que descubra a URL poderia forjar mensagens.
      const sigHeader = req.headers["x-hub-signature-256"];
      const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET)) {
        logger.warn({ url: req.url }, "whatsapp.webhook.signature.invalid");
        return reply.status(401).send({ message: "Assinatura inválida" });
      }

      const requestId = randomUUID();

      // Responde 200 imediatamente — Meta exige ACK rápido
      void reply.send({ ok: true });

      const messages = extractMessages(req.body);
      const statuses = extractStatuses(req.body);

      logger.info(
        { requestId, messages: messages.length, statuses: statuses.length },
        "whatsapp.webhook.received"
      );

      const sessionStore = getSessionStore();
      const adapter = getWhatsAppAdapter();

      // Dedup + processamento assíncrono (não bloqueia o ACK já enviado).
      // A Meta reentrega o webhook (entrega ao-menos-uma-vez); claimMessage
      // garante que cada messageId seja processado uma única vez.
      for (const msg of messages) {
        if ((await claimMessage(msg.messageId)) === "duplicate") {
          logger.info({ requestId, messageId: msg.messageId }, "whatsapp.webhook.duplicate.skipped");
          continue;
        }
        processMessage(msg, { sessionStore, adapter }).catch(async (err) => {
          logger.error({ requestId, from: msg.from, err }, "whatsapp.message.process.error");
          // Libera a dedup-key para permitir reprocesso na reentrega da Meta.
          await releaseMessage(msg.messageId);
        });
      }

      for (const status of statuses) {
        logger.info({ requestId, messageId: status.messageId, status: status.status }, "whatsapp.status.update");
      }
    },
  });
};
