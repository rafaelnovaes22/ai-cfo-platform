import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getStripe } from "@/billing/stripe.js";
import * as billingService from "@/billing/service.js";
import { requireAuth } from "@/auth/middleware.js";
import { CheckoutBody, CheckoutResponse, PortalResponse, SubscriptionResponse } from "@/billing/schemas.js";
import { logger } from "@/observability/logger.js";

export const billingRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.get("/billing/subscription", {
    schema: { response: { 200: SubscriptionResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const sub = await billingService.getSubscription(req.auth!.tenantId);
      return reply.send({
        ...sub,
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      });
    },
  });

  f.post("/billing/checkout", {
    schema: { body: CheckoutBody, response: { 200: CheckoutResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const result = await billingService.createCheckoutSession(req.auth!.tenantId, req.body.plan);
      return reply.send(result);
    },
  });

  f.post("/billing/portal", {
    schema: { response: { 200: PortalResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const result = await billingService.createPortalSession(req.auth!.tenantId);
      return reply.send(result);
    },
  });

  // Webhook — corpo bruto necessário para verificação de assinatura Stripe
  // rawBody habilitado via fastify-raw-body (config: { rawBody: true })
  app.post("/billing/webhook", {
    config: { rawBody: true },
    handler: async (req, reply) => {
      const sig = req.headers["stripe-signature"];
      const secret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !secret) {
        return reply.status(400).send({ message: "Webhook mal configurado" });
      }

      let event;
      try {
        event = getStripe().webhooks.constructEvent(
          (req as unknown as { rawBody: Buffer }).rawBody,
          sig,
          secret,
        );
      } catch (err) {
        logger.warn({ err }, "Assinatura de webhook inválida");
        return reply.status(400).send({ message: "Assinatura inválida" });
      }

      await billingService.handleWebhookEvent(event);
      return reply.send({ received: true });
    },
  });

  // Rota de sucesso pós-checkout (redireciona pro frontend)
  f.get("/billing/success", {
    schema: { querystring: z.object({ session_id: z.string() }) },
    handler: async (_req, reply) => {
      return reply.redirect(`${process.env.APP_URL}/dashboard?billing=success`);
    },
  });
};
