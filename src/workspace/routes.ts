import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as workspaceService from "@/workspace/service.js";
import { requireAuth, requireRole } from "@/auth/middleware.js";
import {
  UpdateProfileBody,
  AddMemberBody,
  ProfileResponse,
  MemberResponse,
  AddMemberResponse,
} from "@/workspace/schemas.js";

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.get("/workspace/profile", {
    schema: { response: { 200: ProfileResponse } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const tenant = await workspaceService.getProfile(req.auth!.tenantId);
      return reply.send({ ...tenant, createdAt: tenant.createdAt.toISOString() });
    },
  });

  f.patch("/workspace/profile", {
    schema: { body: UpdateProfileBody, response: { 200: ProfileResponse } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const tenant = await workspaceService.updateProfile(req.auth!.tenantId, req.body);
      return reply.send({ ...tenant, createdAt: tenant.createdAt.toISOString() });
    },
  });

  f.get("/workspace/members", {
    schema: { response: { 200: z.array(MemberResponse) } },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const members = await workspaceService.listMembers(req.auth!.tenantId);
      return reply.send(
        members.map((m) => ({ ...m, lastLoginAt: m.lastLoginAt?.toISOString() ?? null })),
      );
    },
  });

  f.post("/workspace/members", {
    schema: { body: AddMemberBody, response: { 201: AddMemberResponse } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      const member = await workspaceService.addMember(req.auth!.tenantId, req.body);
      return reply.status(201).send({
        ...member,
        lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
      });
    },
  });

  f.delete("/workspace/members/:userId", {
    schema: { params: z.object({ userId: z.string() }), response: { 204: z.null() } },
    preHandler: [requireAuth, requireRole("admin")],
    handler: async (req, reply) => {
      await workspaceService.removeMember(req.auth!.tenantId, req.params.userId, req.auth!.userId);
      return reply.status(204).send(null);
    },
  });
};
