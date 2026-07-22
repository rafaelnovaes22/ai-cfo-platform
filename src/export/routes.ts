import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireScope } from "@/auth/middleware.js";
import { generateReport } from "@/export/generator.js";
import { logger } from "@/observability/logger.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import { decideExport, buildExportFilename } from "@/export/predicates.js";

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
    preHandler: [requireAuth, requireScope("export:read")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const { analysisId, type } = req.params;
      const startedAt = Date.now();

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

      const decision = decideExport(analysis);
      if (decision.status === "not_found" || !analysis) {
        return reply.status(404).send({ message: "Análise não encontrada" });
      }
      if (decision.status === "status_gate") {
        return reply.status(422).send({
          message: "Análise ainda não disponível para exportação",
          status: decision.analysisStatus,
        });
      }
      if (decision.status === "dre_missing") {
        return reply.status(422).send({ message: "DRE ainda não gerada" });
      }

      const filename = buildExportFilename(analysis.referenceMonth, type);
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

      // C6 + auditoria (LGPD) — log estruturado de cada download. TODO Onda C+: persistir em export_audit.
      logger.info(
        {
          event: "export_download",
          tenantId:       req.auth!.tenantId,
          userId:         req.auth!.userId,
          analysisId,
          referenceMonth: analysis.referenceMonth,
          type,
          status:         analysis.status,
          mode:           analysis.mode,
          latencyMs:      Date.now() - startedAt,
        },
        "PDF exportado",
      );

      return reply.send(stream);
    },
  });
};
