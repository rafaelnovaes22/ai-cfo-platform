import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import { defaultErrorResponses, problemDetail } from "@/http/problem-detail.js";

const CorrectBody = z.object({
  category: z.enum(DRE_CATEGORIES as [string, ...string[]]),
  source: z.enum(["rafael", "client"]).default("client"),
});

const ReviewEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amountCents: z.number(),
  direction: z.string(),
  predictedCategory: z.string().nullable(),
  confirmedCategory: z.string().nullable(),
  classificationConfidence: z.number().nullable(),
  correctionSource: z.string().nullable(),
});

export const classificationRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Retorna lançamentos de baixa confiança — envelope {data, meta} (contrato OpenAPI).
  f.get("/classification/:analysisId/review", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: {
        200: z.object({
          data: z.array(ReviewEntrySchema),
          meta: z.object({
            cursor: z.string().nullable(),
            hasMore: z.boolean(),
            total: z.number(),
            requestId: z.string(),
          }),
        }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const requestId = randomUUID();

      const entries = await db.ledgerEntry.findMany({
        where: {
          analysisId: req.params.analysisId,
          tenantId: req.auth!.tenantId,
        },
        select: {
          id: true, date: true, description: true, amountCents: true,
          direction: true, predictedCategory: true, confirmedCategory: true,
          classificationConfidence: true, correctionSource: true,
        },
        orderBy: { date: "asc" },
      });

      const data = entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) }));
      reply.header("X-Request-Id", requestId);
      return reply.send({
        data,
        meta: { cursor: null, hasMore: false, total: data.length, requestId },
      });
    },
  });

  // Corrige a categoria de um lançamento (flywheel de treinamento)
  f.patch("/classification/entries/:entryId/correct", {
    schema: {
      params: z.object({ entryId: z.string() }),
      body: CorrectBody,
      response: {
        200: z.object({ id: z.string(), confirmedCategory: z.string() }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const requestId = randomUUID();
      reply.header("X-Request-Id", requestId);

      // Garante que a entrada pertence ao tenant (C8 — sem acesso cruzado)
      const entry = await db.ledgerEntry.findFirst({
        where: { id: req.params.entryId, tenantId: req.auth!.tenantId },
      });
      if (!entry) {
        return reply.status(404).type("application/problem+json").send(problemDetail({
          type: "https://api.aicfo.com.br/errors/entry-not-found",
          title: "Lançamento não encontrado",
          status: 404,
          detail: `Nenhum lançamento ${req.params.entryId} pertence a este tenant.`,
          instance: req.url,
          requestId,
        }));
      }

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
