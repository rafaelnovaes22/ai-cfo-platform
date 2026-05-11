import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as authService from "@/auth/service.js";
import { requireAuth } from "@/auth/middleware.js";
import { RegisterBody, LoginBody, RefreshBody, TokenResponse, MeResponse } from "@/auth/schemas.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.post("/auth/register", {
    schema: { body: RegisterBody, response: { 201: TokenResponse } },
    handler: async (req, reply) => {
      const tokens = await authService.register(req.body);
      return reply.status(201).send(tokens);
    },
  });

  f.post("/auth/login", {
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
      return reply.status(204).send();
    },
  });

  f.get("/auth/me", {
    schema: { response: { 200: MeResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      return reply.send({
        userId: req.auth!.userId,
        tenantId: req.auth!.tenantId,
        role: req.auth!.role,
      });
    },
  });
};
