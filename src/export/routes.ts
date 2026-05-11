import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth } from "@/auth/middleware.js";
import { generateReport } from "@/export/generator.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

const REPORT_TYPES = ["monthly", "investors", "partners"] as const;

export const exportRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.get("/analysis/:analysisId/export/:type", {
    schema: {
      params: z.object({
        analysisId: z.string(),
        type:       z.enum(REPORT_TYPES),
      }),
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const db = getPrisma();
      const { analysisId, type } = req.params;

      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: analysisId, tenantId: req.auth!.tenantId },
        include: {
          tenant:        { select: { name: true } },
          narrativeCards: {
            select:  { cardType: true, title: true, body: true },
            orderBy: { createdAt: "asc" },
          },
          actionItems: {
            select: {
              horizon: true, title: true, description: true,
              effortLevel: true, riskLevel: true, impactCents: true, doneWhen: true,
            },
            orderBy: [{ horizon: "asc" }, { impactCents: "desc" }],
          },
        },
      });

      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });
      if (!analysis.dreJson) return reply.status(422).send({ message: "DRE ainda não gerada" });

      const filename = `aicfo-${analysis.referenceMonth}-${type}.pdf`;
      reply.type("application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      const stream = generateReport(
        {
          tenantName:     analysis.tenant.name,
          referenceMonth: analysis.referenceMonth,
          dre:            analysis.dreJson as unknown as DreLines,
          cards:          analysis.narrativeCards,
          actions:        analysis.actionItems,
        },
        type,
      );

      return reply.send(stream);
    },
  });
};
