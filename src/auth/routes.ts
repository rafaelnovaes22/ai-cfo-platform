import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as authService from "@/auth/service.js";
import * as passwordReset from "@/auth/password-reset.js";
import { requireAuth } from "@/auth/middleware.js";
import { isSubscriber } from "@/auth/subscription-access.js";
import { getPrisma } from "@/persistence/prisma.js";
import {
  RegisterBody,
  LoginBody,
  RefreshBody,
  TokenResponse,
  MeResponse,
  PasswordResetRequestBody,
  PasswordResetConfirmBody,
  PasswordResetResponse,
} from "@/auth/schemas.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Brute force: login/register têm teto próprio bem abaixo do global de
  // 100/min (o comentário do server.ts prometia isto, mas não existia).
  const strictRateLimit = {
    rateLimit: {
      max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      timeWindow: "1 minute" as const,
    },
  };

  f.post("/auth/register", {
    config: strictRateLimit,
    schema: { body: RegisterBody, response: { 201: TokenResponse } },
    handler: async (req, reply) => {
      const tokens = await authService.register(req.body);
      return reply.status(201).send(tokens);
    },
  });

  f.post("/auth/login", {
    config: strictRateLimit,
    schema: { body: LoginBody, response: { 200: TokenResponse } },
    handler: async (req, reply) => {
      const tokens = await authService.login(req.body.email, req.body.password);
      return reply.send(tokens);
    },
  });

  f.post("/auth/refresh", {
    schema: { body: RefreshBody, response: { 200: TokenResponse } },
    handler: async (req, reply) => {
      const tokens = await authService.refresh(req.body.refreshToken);
      return reply.send(tokens);
    },
  });

  f.post("/auth/logout", {
    schema: { body: RefreshBody, response: { 204: z.null() } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      await authService.logout(req.body.refreshToken);
      return reply.status(204).send(null);
    },
  });

  f.get("/auth/me", {
    schema: { response: { 200: MeResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const user = await db.user.findUnique({
        where: { id: req.auth!.userId },
        select: { name: true, email: true },
      });
      if (!user) throw Object.assign(new Error("Usuário não encontrado"), { statusCode: 404 });
      const subscription = await db.subscription.findUnique({
        where: { tenantId: req.auth!.tenantId },
        select: { plan: true, status: true },
      });
      const plan = subscription?.plan ?? "trial";
      const subscriptionStatus = subscription?.status ?? "active";
      return reply.send({
        userId: req.auth!.userId,
        tenantId: req.auth!.tenantId,
        role: req.auth!.role,
        name: user.name,
        email: user.email,
        plan,
        subscriptionStatus,
        isSubscriber: isSubscriber(plan, subscriptionStatus),
      });
    },
  });

  // Always 200 — não revela existência de email na base.
  f.post("/auth/password-reset/request", {
    schema: { body: PasswordResetRequestBody, response: { 200: PasswordResetResponse } },
    handler: async (req, reply) => {
      await passwordReset.requestPasswordReset(req.body.email);
      return reply.send({ ok: true });
    },
  });

  f.post("/auth/password-reset/confirm", {
    schema: { body: PasswordResetConfirmBody, response: { 200: PasswordResetResponse } },
    handler: async (req, reply) => {
      await passwordReset.confirmPasswordReset(req.body.token, req.body.password);
      return reply.send({ ok: true });
    },
  });
};
