import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";

const ActionItemSchema = z.object({
  id:           z.string(),
  horizon:      z.string(),
  title:        z.string(),
  description:  z.string(),
  effortLevel:  z.string(),
  riskLevel:    z.string(),
  impactCents:  z.number(),
  deadlineDays: z.number().nullable(),
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
      },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
      });
      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });

      const items = await db.actionPlanItem.findMany({
        where: { analysisId: req.params.analysisId },
        orderBy: [{ horizon: "asc" }, { impactCents: "desc" }],
      });

      const sum = (h: string) =>
        items.filter((i) => i.horizon === h).reduce((acc, i) => acc + i.impactCents, 0);

      return reply.send({
        items,
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
      response: { 200: z.object({ id: z.string() }) },
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
      if (!item) return reply.status(404).send({ message: "Item não encontrado" });

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
      response: { 200: z.object({ status: z.string(), approvedAt: z.string() }) },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
      });
      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });
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
