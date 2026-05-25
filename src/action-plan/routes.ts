import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";
import { defaultErrorResponses, problemDetail } from "@/http/problem-detail.js";

// Alinhado com ActionSchema do generator.ts — horizon e níveis fechados em enum (C2 spec §1).
const ActionItemSchema = z.object({
  id:           z.string(),
  horizon:      z.enum(["short", "medium", "long"]),
  title:        z.string(),
  description:  z.string(),
  effortLevel:  z.enum(["low", "medium", "high"]),
  riskLevel:    z.enum(["low", "medium", "high"]),
  impactCents:  z.number(),
  deadlineDays: z.number().nullable(),
  // Spec exige doneWhen obrigatório em novos planos (generator.ts impõe via Zod refinement).
  // Mantido nullable no response até migration backfillar registros legados (TODO Onda C+).
  doneWhen:     z.string().nullable(),
  clientApproved: z.boolean().nullable(),
  clientComment:  z.string().nullable(),
});

export const actionPlanRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Plano de ação completo
  f.get("/analysis/:analysisId/action-plan", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: {
        200: z.object({
          items: z.array(ActionItemSchema),
          summary: z.object({
            shortImpact:  z.number(),
            mediumImpact: z.number(),
            longImpact:   z.number(),
            totalImpact:  z.number(),
          }),
        }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("assisted", "autonomous")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
      });
      if (!analysis) {
        return reply.status(404).send(problemDetail({
          type: "https://api.aicfo.com.br/errors/analysis-not-found",
          title: "Análise não encontrada",
          status: 404,
          instance: req.url,
          requestId: randomUUID(),
        }));
      }

      const items = await db.actionPlanItem.findMany({
        where: { analysisId: req.params.analysisId },
        orderBy: [{ horizon: "asc" }, { impactCents: "desc" }],
      });

      const sum = (h: string) =>
        items.filter((i) => i.horizon === h).reduce((acc, i) => acc + i.impactCents, 0);

      // Prisma gera horizon/effortLevel/riskLevel como nativeEnum; valores são idênticos
      // ao z.enum() do response schema, mas TS não infere essa equivalência.
      return reply.send({
        items: items as z.infer<typeof ActionItemSchema>[],
        summary: {
          shortImpact:  sum("short"),
          mediumImpact: sum("medium"),
          longImpact:   sum("long"),
          totalImpact:  items.reduce((acc, i) => acc + i.impactCents, 0),
        },
      });
    },
  });

  // Feedback do cliente (ASSISTED)
  f.patch("/analysis/:analysisId/action-plan/:itemId/feedback", {
    schema: {
      params: z.object({ analysisId: z.string(), itemId: z.string() }),
      body: z.object({
        approved: z.boolean(),
        comment: z.string().max(500).optional(),
      }),
      response: { 200: z.object({ id: z.string() }), ...defaultErrorResponses },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const item = await db.actionPlanItem.findFirst({
        where: {
          id: req.params.itemId,
          analysis: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        },
      });
      if (!item) {
        return reply.status(404).send(problemDetail({
          type: "https://api.aicfo.com.br/errors/action-item-not-found",
          title: "Item não encontrado",
          status: 404,
          instance: req.url,
          requestId: randomUUID(),
        }));
      }

      const updated = await db.actionPlanItem.update({
        where: { id: item.id },
        data: { clientApproved: req.body.approved, clientComment: req.body.comment ?? null },
      });
      return reply.send({ id: updated.id });
    },
  });

  // Aprovação do mês (fecha a análise no modo ASSISTED)
  f.post("/analysis/:analysisId/approve", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: {
        200: z.object({ status: z.string(), approvedAt: z.string() }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
      });
      if (!analysis) {
        return reply.status(404).send(problemDetail({
          type: "https://api.aicfo.com.br/errors/analysis-not-found",
          title: "Análise não encontrada",
          status: 404,
          instance: req.url,
          requestId: randomUUID(),
        }));
      }
      if (analysis.status === "approved") return reply.send({
        status: "approved",
        approvedAt: analysis.approvedAt!.toISOString(),
      });

      const now = new Date();
      await db.monthlyAnalysis.update({
        where: { id: analysis.id },
        data: { status: "approved", approvedAt: now },
      });
      return reply.send({ status: "approved", approvedAt: now.toISOString() });
    },
  });
};
