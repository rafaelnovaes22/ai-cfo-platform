import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as configService from "@/tenant-config/service.js";
import { requireAuth, requireRole } from "@/auth/middleware.js";
import {
  ProductConfigBody,
  ChangeRoleBody,
  CreateTokenBody,
  TokenListItem,
  CreateTokenResponse,
} from "@/tenant-config/schemas.js";

const isoOrNull = (d: Date | null) => d?.toISOString() ?? null;

export const tenantConfigRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // ── productConfig (L1) ──────────────────────────────────────────────────

  f.get("/config", {
    schema: { response: { 200: z.record(z.unknown()) } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      return reply.send(await configService.getConfig(req.auth!.tenantId));
    },
  });

  f.patch("/config", {
    schema: { body: ProductConfigBody, response: { 200: z.record(z.unknown()) } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      return reply.send(await configService.updateConfig(req.auth!.tenantId, req.body));
    },
  });

  // ── RBAC ────────────────────────────────────────────────────────────────

  f.patch("/config/members/:userId/role", {
    schema: {
      params: z.object({ userId: z.string() }),
      body: ChangeRoleBody,
      response: { 200: z.object({ id: z.string(), role: z.string() }) },
    },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const user = await configService.changeRole(
        req.auth!.tenantId,
        req.params.userId,
        req.auth!.userId,
        req.body.role,
      );
      return reply.send({ id: user.id, role: user.role });
    },
  });

  // ── API Tokens ──────────────────────────────────────────────────────────

  f.get("/config/tokens", {
    schema: { response: { 200: z.array(TokenListItem) } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const tokens = await configService.listTokens(req.auth!.tenantId);
      return reply.send(
        tokens.map((t) => ({
          ...t,
          lastUsedAt: isoOrNull(t.lastUsedAt),
          expiresAt: isoOrNull(t.expiresAt),
          createdAt: t.createdAt.toISOString(),
        })),
      );
    },
  });

  f.post("/config/tokens", {
    schema: { body: CreateTokenBody, response: { 201: CreateTokenResponse } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const result = await configService.createToken(req.auth!.tenantId, req.body);
      return reply.status(201).send({
        ...result,
        lastUsedAt: isoOrNull(result.lastUsedAt),
        expiresAt: isoOrNull(result.expiresAt),
        createdAt: result.createdAt.toISOString(),
      });
    },
  });

  f.delete("/config/tokens/:tokenId", {
    schema: { params: z.object({ tokenId: z.string() }), response: { 204: z.null() } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      await configService.revokeToken(req.auth!.tenantId, req.params.tokenId);
      return reply.status(204).send(null);
    },
  });
};
