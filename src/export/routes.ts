import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth } from "@/auth/middleware.js";
import { generateReport } from "@/export/generator.js";
import { logger } from "@/observability/logger.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

// referenceMonth válido = "YYYY-MM" — defesa contra filename injection via dado persistido.
const REFERENCE_MONTH_RE = /^\d{4}-\d{2}$/;

const REPORT_TYPES = ["monthly", "investors", "partners"] as const;

// C4 — em SHADOW a análise nunca sai do status "ready"; só pode exportar
// depois que humano revisou e mode transitou para entrega ao cliente.
const EXPORTABLE_STATUS = ["delivered", "approved"] as const;

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

      if (!analysis) return reply.status(404).send({ message: "Análise não encontrada" });
      if (!(EXPORTABLE_STATUS as readonly string[]).includes(analysis.status)) {
        return reply.status(422).send({
          message: "Análise ainda não disponível para exportação",
          status: analysis.status,
        });
      }
      if (!analysis.dreJson) return reply.status(422).send({ message: "DRE ainda não gerada" });

      // C8 — sanitização de filename: referenceMonth tem que casar com YYYY-MM antes de virar nome de arquivo.
      const safeMonth = REFERENCE_MONTH_RE.test(analysis.referenceMonth) ? analysis.referenceMonth : "invalid";
      const filename = `aicfo-${safeMonth}-${type}.pdf`;
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
