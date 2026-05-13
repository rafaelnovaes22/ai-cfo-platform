import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";
import { defaultErrorResponses, problemDetail } from "@/http/problem-detail.js";

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

function notFound(req: { url: string }, title: string) {
  return problemDetail({
    type: "https://api.aicfo.com.br/errors/not-found",
    title,
    status: 404,
    instance: req.url,
    requestId: randomUUID(),
  });
}

// Coerce do Prisma JsonValue → shape do Zod evidence; evidence é gravada como JSON.
function coerceCard(card: {
  id: string;
  cardType: string;
  title: string;
  body: string;
  evidence: unknown;
  clientApproved: boolean | null;
  clientComment: string | null;
}): z.infer<typeof CardSchema> {
  const evidence = Array.isArray(card.evidence) ? (card.evidence as z.infer<typeof EvidenceSchema>[]) : [];
  return {
    id: card.id,
    cardType: card.cardType,
    title: card.title,
    body: card.body,
    evidence,
    clientApproved: card.clientApproved,
    clientComment: card.clientComment,
  };
}

export const dreNarrativeRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // DRE agregada
  f.get("/analysis/:analysisId/dre", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: { 200: z.record(z.unknown()), ...defaultErrorResponses },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        select: { dreJson: true, referenceMonth: true, status: true },
      });
      if (!analysis) return reply.status(404).send(notFound(req, "Análise não encontrada"));
      return reply.send(analysis as Record<string, unknown>);
    },
  });

  // Cards de narrativa — em SHADOW o cliente NÃO vê (C4: gerada mas não entregue).
  f.get("/analysis/:analysisId/narrative", {
    schema: {
      params: z.object({ analysisId: z.string() }),
      response: { 200: z.array(CardSchema), ...defaultErrorResponses },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        select: { id: true, mode: true },
      });
      if (!analysis) return reply.status(404).send(notFound(req, "Análise não encontrada"));
      if (analysis.mode === "shadow") {
        return reply.status(404).send(notFound(req, "Análise não encontrada"));
      }

      const cards = await db.narrativeCard.findMany({
        where: { analysisId: req.params.analysisId },
        orderBy: { createdAt: "asc" },
      });
      return reply.send(cards.map(coerceCard));
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
      response: { 200: z.object({ id: z.string() }), ...defaultErrorResponses },
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
      if (!card) return reply.status(404).send(notFound(req, "Card não encontrado"));

      const updated = await db.narrativeCard.update({
        where: { id: card.id },
        data: { clientApproved: req.body.approved, clientComment: req.body.comment ?? null },
      });
      return reply.send({ id: updated.id });
    },
  });
};
