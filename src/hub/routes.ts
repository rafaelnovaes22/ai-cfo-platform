import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireScope } from "@/auth/middleware.js";
import { defaultErrorResponses, problemDetail } from "@/http/problem-detail.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

const DreSnapshotSchema = z.object({
  receitaBruta:  z.number(),
  lucroLiquido:  z.number(),
  margemLiquida: z.number(),
  ebitda:        z.number(),
  margemEbitda:  z.number(),
});

const TrendPointSchema = z.object({
  referenceMonth:   z.string(),
  receitaLiquida:   z.number(),
  lucroLiquido:     z.number(),
  ebitda:           z.number(),
  margemBruta:      z.number(),
  margemOperacional: z.number(),
  margemLiquida:    z.number(),
});

const AnomalyTimelinePointSchema = z.object({
  referenceMonth: z.string(),
  total:          z.number(),
  high:           z.number(),
  medium:         z.number(),
  low:            z.number(),
  codes:          z.array(z.string()),
});

const AnalysisSummarySchema = z.object({
  id:               z.string(),
  referenceMonth:   z.string(),
  status:           z.string(),
  mode:             z.string(),
  deliveredAt:      z.string().nullable(),
  approvedAt:       z.string().nullable(),
  costCents:        z.number().nullable(),
  totalImpactCents: z.number().nullable(),
});

export const hubRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Snapshot da home — última análise + info de subscription
  f.get("/hub", {
    schema: {
      response: {
        200: z.object({
          subscription: z.object({ plan: z.string(), mode: z.string(), status: z.string() }),
          latestAnalysis: z.object({
            id:             z.string(),
            referenceMonth: z.string(),
            status:         z.string(),
            mode:           z.string(),
            deliveredAt:    z.string().nullable(),
            approvedAt:     z.string().nullable(),
            dre:            DreSnapshotSchema.nullable(),
            cards: z.object({
              critical_gap: z.number(),
              attention:    z.number(),
              healthy:      z.number(),
            }),
            actionPlan: z.object({
              total:             z.number(),
              shortImpactCents:  z.number(),
              mediumImpactCents: z.number(),
              longImpactCents:   z.number(),
              totalImpactCents:  z.number(),
            }).nullable(),
          }).nullable(),
        }),
      },
    },
    preHandler: [requireAuth, requireScope('hub:read')],
    handler: async (req, reply) => {
      const db = getPrisma();
      const { tenantId } = req.auth!;

      const [subscription, latestAnalysis] = await Promise.all([
        db.subscription.findUnique({ where: { tenantId } }),
        db.monthlyAnalysis.findFirst({
          where: { tenantId },
          orderBy: { referenceMonth: "desc" },
          include: {
            narrativeCards: { select: { cardType: true } },
            actionItems:    { select: { horizon: true, impactCents: true } },
          },
        }),
      ]);

      const subInfo = subscription
        ? { plan: subscription.plan, mode: subscription.mode, status: subscription.status }
        : { plan: "trial", mode: "assisted", status: "active" };

      if (!latestAnalysis) return reply.send({ subscription: subInfo, latestAnalysis: null });

      const dreRaw = latestAnalysis.dreJson as DreLines | null;
      const dre = dreRaw
        ? {
            receitaBruta:  dreRaw.receitaBruta,
            lucroLiquido:  dreRaw.lucroLiquido,
            margemLiquida: dreRaw.margemLiquida,
            ebitda:        dreRaw.ebitda,
            margemEbitda:  dreRaw.margemEbitda,
          }
        : null;

      const cards = {
            critical_gap: latestAnalysis.narrativeCards.filter((c) => c.cardType === "critical_gap").length,
            attention:    latestAnalysis.narrativeCards.filter((c) => c.cardType === "attention").length,
            healthy:      latestAnalysis.narrativeCards.filter((c) => c.cardType === "healthy").length,
          };

      const items = latestAnalysis.actionItems;
      const sumH = (h: string) =>
        items.filter((i) => i.horizon === h).reduce((acc, i) => acc + i.impactCents, 0);

      const actionPlan = (items.length > 0)
        ? {
            total:             items.length,
            shortImpactCents:  sumH("short"),
            mediumImpactCents: sumH("medium"),
            longImpactCents:   sumH("long"),
            totalImpactCents:  items.reduce((acc, i) => acc + i.impactCents, 0),
          }
        : null;

      return reply.send({
        subscription: subInfo,
        latestAnalysis: {
          id:             latestAnalysis.id,
          referenceMonth: latestAnalysis.referenceMonth,
          status:         latestAnalysis.status,
          mode:           latestAnalysis.mode,
          deliveredAt:    latestAnalysis.deliveredAt?.toISOString() ?? null,
          approvedAt:     latestAnalysis.approvedAt?.toISOString() ?? null,
          dre,
          cards,
          actionPlan,
        },
      });
    },
  });

  // Série temporal — últimos 12 meses fechados com métricas DRE para gráficos
  f.get("/analyses/trend", {
    schema: {
      response: { 200: z.object({ trend: z.array(TrendPointSchema) }) },
    },
    preHandler: [requireAuth, requireScope("hub:read")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const records = await db.monthlyAnalysis.findMany({
        where: {
          tenantId: req.auth!.tenantId,
          status: { in: ["ready", "delivered", "approved"] },
        },
        orderBy: { referenceMonth: "desc" },
        take: 12,
        select: { referenceMonth: true, dreJson: true },
      });

      const trend = records
        .filter((r) => r.dreJson != null)
        .reverse()
        .map((r) => {
          const d = r.dreJson as unknown as DreLines;
          return {
            referenceMonth:    r.referenceMonth,
            receitaLiquida:    d.receitaLiquida,
            lucroLiquido:      d.lucroLiquido,
            ebitda:            d.ebitda,
            margemBruta:       d.margemBruta,
            margemOperacional: d.margemOperacional,
            margemLiquida:     d.margemLiquida,
          };
        });

      return reply.send({ trend });
    },
  });

  // Timeline de anomalias — últimos 12 meses com contagem e códigos por severidade
  f.get("/analyses/anomaly-timeline", {
    schema: {
      response: { 200: z.object({ timeline: z.array(AnomalyTimelinePointSchema) }) },
    },
    preHandler: [requireAuth, requireScope("hub:read")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const records = await db.monthlyAnalysis.findMany({
        where: {
          tenantId: req.auth!.tenantId,
          status: { in: ["ready", "delivered", "approved"] },
        },
        orderBy: { referenceMonth: "desc" },
        take: 12,
        select: { referenceMonth: true, anomaliesJson: true },
      });

      type RawAnomaly = { code: string; severity: string };

      const timeline = records
        .filter((r) => r.anomaliesJson != null)
        .reverse()
        .map((r) => {
          const anomalies = r.anomaliesJson as RawAnomaly[];
          return {
            referenceMonth: r.referenceMonth,
            total:          anomalies.length,
            high:           anomalies.filter((a) => a.severity === "high").length,
            medium:         anomalies.filter((a) => a.severity === "medium").length,
            low:            anomalies.filter((a) => a.severity === "low").length,
            codes:          [...new Set(anomalies.map((a) => a.code))],
          };
        });

      return reply.send({ timeline });
    },
  });

  // Histórico — últimas 12 análises do tenant
  f.get("/analyses", {
    schema: {
      response: { 200: z.object({ analyses: z.array(AnalysisSummarySchema) }) },
    },
    preHandler: [requireAuth, requireScope('hub:read')],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analyses = await db.monthlyAnalysis.findMany({
        where:   { tenantId: req.auth!.tenantId },
        orderBy: { referenceMonth: "desc" },
        take:    12,
        select: {
          id: true, referenceMonth: true, status: true, mode: true,
          deliveredAt: true, approvedAt: true, costCents: true,
          actionPlanJson: true,
        },
      });

      return reply.send({
        analyses: analyses.map((a) => {
          const plan = a.actionPlanJson as { totalImpact?: number } | null;
          return {
            id:               a.id,
            referenceMonth:   a.referenceMonth,
            status:           a.status,
            mode:             a.mode,
            deliveredAt:      a.deliveredAt?.toISOString() ?? null,
            approvedAt:       a.approvedAt?.toISOString() ?? null,
            costCents:        a.costCents,
            totalImpactCents: plan?.totalImpact ?? null,
          };
        }),
      });
    },
  });

  // Status enxuto de UMA análise — para o front fazer polling pós-upload e reidratar
  // o loading após F5 sem puxar a lista inteira. Fonte de verdade do estado de geração.
  f.get("/analysis/:analysisId/status", {
    schema: {
      params: z.object({ analysisId: z.string().uuid() }),
      response: {
        200: z.object({
          id:              z.string(),
          referenceMonth:  z.string(),
          // pending | generating | ready | delivered | approved | failed
          status:          z.string(),
          mode:            z.string(),
          hasActionPlan:   z.boolean(),
          actionItemCount: z.number(),
          generatedAt:     z.string().datetime().nullable(),
          deliveredAt:     z.string().datetime().nullable(),
        }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireScope('hub:read')],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
        select: {
          id: true, referenceMonth: true, status: true, mode: true,
          actionPlanJson: true, generatedAt: true, deliveredAt: true,
          _count: { select: { actionItems: true } },
        },
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
      return reply.send({
        id:              analysis.id,
        referenceMonth:  analysis.referenceMonth,
        status:          analysis.status,
        mode:            analysis.mode,
        hasActionPlan:   analysis.actionPlanJson != null,
        actionItemCount: analysis._count.actionItems,
        generatedAt:     analysis.generatedAt?.toISOString() ?? null,
        deliveredAt:     analysis.deliveredAt?.toISOString() ?? null,
      });
    },
  });
};
