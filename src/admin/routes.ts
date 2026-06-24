import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  CreateTenantBody,
  CreateTenantResponse,
  ListTenantsQuery,
  ListTenantsResponse,
} from "@/admin/schemas.js";
import { requireAdminKey } from "@/admin/middleware.js";
import * as adminService from "@/admin/service.js";
import { defaultErrorResponses } from "@/http/problem-detail.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Rotas admin são internas (operacional) — escondidas do OpenAPI público.
  f.post("/admin/tenants", {
    schema: {
      hide: true,
      body: CreateTenantBody,
      response: { 201: CreateTenantResponse, ...defaultErrorResponses },
    },
    preHandler: [requireAdminKey],
    handler: async (req, reply) => {
      const result = await adminService.createTenant(req.body);
      return reply.status(201).send(result);
    },
  });

  f.get("/admin/tenants", {
    schema: {
      hide: true,
      querystring: ListTenantsQuery,
      response: { 200: ListTenantsResponse, ...defaultErrorResponses },
    },
    preHandler: [requireAdminKey],
    handler: async (req, reply) => {
      const result = await adminService.listTenants({
        search: req.query.search,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return reply.send(result);
    },
  });
};
