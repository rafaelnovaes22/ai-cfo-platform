import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";

const EvidenceSchema = z.object({
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
});

const CardSchema = z.object({
  id: z.string(),
  cardType: z.string(),
  title: z.string(),
  body: z.string(),
  evidence: z.array(EvidenceSchema),
  clientApproved: z.boolean().nullable(),
  clientComment: z.string().nullable(),
});

export const dreNarrativeRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // DRE agregada
  f.get("/analysis/:analysisId/dre", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: { 200: z.record(z.unknown()) },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        select: { dreJson: true, referenceMonth: true, status: true },
      });
      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });
      return reply.send(analysis);
    },
  });

  // Cards de narrativa — em SHADOW o cliente NÃO vê (C4: gerada mas não entregue).
  f.get("/analysis/:analysisId/narrative", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: { 200: z.array(CardSchema) },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        select: { id: true, mode: true },
      });
      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });
      if (analysis.mode === "shadow") {
        return reply.status(404).send({ message: "Análise não encontrada" });
      }

      const cards = await db.narrativeCard.findMany({
        where: { analysisId: req.params.analysisId },
        orderBy: { createdAt: "asc" },
      });
      return reply.send(cards);
    },
  });

  // Feedback do cliente em modo ASSISTED
  f.patch("/analysis/:analysisId/narrative/:cardId/feedback", {
    schema: {
      params: z.object({ analysisId: z.string(), cardId: z.string() }),
      body: z.object({
        approved: z.boolean(),
        comment: z.string().max(500).optional(),
      }),
      response: { 200: z.object({ id: z.string() }) },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const card = await db.narrativeCard.findFirst({
        where: {
          id: req.params.cardId,
          analysis: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        },
      });
      if (!card) return reply.status(404).send({ message: "Card não encontrado" });

      const updated = await db.narrativeCard.update({
        where: { id: card.id },
        data: { clientApproved: req.body.approved, clientComment: req.body.comment ?? null },
      });
      return reply.send({ id: updated.id });
    },
  });
};
