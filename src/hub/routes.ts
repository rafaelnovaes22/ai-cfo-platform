import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireScope } from "@/auth/middleware.js";
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
          const d = r.dreJson as DreLines;
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
};
