import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth } from "@/auth/middleware.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";

const CorrectBody = z.object({
  category: z.enum(DRE_CATEGORIES as [string, ...string[]]),
  source: z.enum(["rafael", "client"]).default("client"),
});

export const classificationRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Retorna lançamentos de baixa confiança de uma análise para revisão
  f.get("/classification/:analysisId/review", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: {
        200: z.array(
          z.object({
            id: z.string(),
            date: z.string(),
            description: z.string(),
            amountCents: z.number(),
            direction: z.string(),
            predictedCategory: z.string().nullable(),
            classificationConfidence: z.number().nullable(),
          }),
        ),
      },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const entries = await db.ledgerEntry.findMany({
        where: {
          analysisId: req.params.analysisId,
          tenantId: req.auth!.tenantId,
          correctionSource: "needs_review",
        },
        select: {
          id: true, date: true, description: true, amountCents: true,
          direction: true, predictedCategory: true, classificationConfidence: true,
        },
        orderBy: { date: "asc" },
      });
      return reply.send(entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })));
    },
  });

  // Corrige a categoria de um lançamento (flywheel de treinamento)
  f.patch("/classification/entries/:entryId/correct", {
    schema: {
      params: z.object({ entryId: z.string() }),
      body: CorrectBody,
      response: { 200: z.object({ id: z.string(), confirmedCategory: z.string() }) },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();

      // Garante que a entrada pertence ao tenant (C8 — sem acesso cruzado)
      const entry = await db.ledgerEntry.findFirst({
        where: { id: req.params.entryId, tenantId: req.auth!.tenantId },
      });
      if (!entry) return reply.status(404).send({ message: "Lançamento não encontrado" });

      const updated = await db.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          correctedCategory: req.body.category,
          confirmedCategory: req.body.category,
          correctionSource:  req.body.source,
        },
        select: { id: true, confirmedCategory: true },
      });

      return reply.send({ id: updated.id, confirmedCategory: updated.confirmedCategory! });
    },
  });
};
