import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { requireAuth, requireMode } from "@/auth/middleware.js";
import { defaultErrorResponses, problemDetail } from "@/http/problem-detail.js";

// Alinhado com ActionSchema do generator.ts — horizon e níveis fechados em enum (C2 spec §1).
const ActionItemSchema = z.object({
  id:           z.string(),
  horizon:      z.enum(["short", "medium", "long"]),
  title:        z.string(),
  description:  z.string(),
  effortLevel:  z.enum(["low", "medium", "high"]),
  riskLevel:    z.enum(["low", "medium", "high"]),
  impactCents:  z.number(),
  deadlineDays: z.number().nullable(),
  // Spec exige doneWhen obrigatório em novos planos (generator.ts impõe via Zod refinement).
  // Mantido nullable no response até migration backfillar registros legados (TODO Onda C+).
  doneWhen:     z.string().nullable(),
  clientApproved: z.boolean().nullable(),
  clientComment:  z.string().nullable(),
  // Lifecycle de execução — ADR-011 Etapa 2
  status:              z.string(),
  statusReason:        z.string().nullable(),
  lastStatusUpdatedAt: z.string().datetime().nullable(),
});

export const actionPlanRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // Plano de ação completo
  f.get("/analysis/:analysisId/action-plan", {
    schema: {
      params: z.object({ analysisId: z.string().uuid() }),
      response: {
        200: z.object({
          // Status da análise dona do plano. O front usa isto para diferenciar um
          // plano ainda EM GERAÇÃO (generating/pending → items vazio é transitório,
          // mantém loading) de um plano CONCLUÍDO sem ações materiais (ready/
          // delivered/approved → items vazio é o resultado final, mostra "sem ações").
          // Sem isto, items=[] é ambíguo e o front fica em loading infinito.
          // Valores possíveis: pending | generating | ready | delivered | approved | failed.
          analysisStatus: z.string(),
          items: z.array(ActionItemSchema),
          summary: z.object({
            shortImpact:  z.number(),
            mediumImpact: z.number(),
            longImpact:   z.number(),
            totalImpact:  z.number(),
          }),
        }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("shadow", "assisted", "autonomous")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
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

      // supersededAt: null → só itens ativos. Itens que uma regeneração deixou de
      // propor e que a cliente não estava executando saem da lista (ficam no histórico).
      const items = await db.actionPlanItem.findMany({
        where: { analysisId: req.params.analysisId, supersededAt: null },
        orderBy: [{ horizon: "asc" }, { impactCents: "desc" }],
      });

      const sum = (h: string) =>
        items.filter((i) => i.horizon === h).reduce((acc, i) => acc + i.impactCents, 0);

      // Prisma gera horizon/effortLevel/riskLevel como nativeEnum; valores são idênticos
      // ao z.enum() do response schema, mas TS não infere essa equivalência.
      // lastStatusUpdatedAt é DateTime? no Prisma — serializa para ISO 8601 ou null.
      return reply.send({
        analysisStatus: analysis.status,
        items: items.map((i) => ({
          ...i,
          lastStatusUpdatedAt: i.lastStatusUpdatedAt ? i.lastStatusUpdatedAt.toISOString() : null,
        })) as z.infer<typeof ActionItemSchema>[],
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
      params: z.object({ analysisId: z.string().uuid(), itemId: z.string().uuid() }),
      body: z.object({
        approved: z.boolean(),
        comment: z.string().max(500).optional(),
      }),
      response: { 200: z.object({ id: z.string() }), ...defaultErrorResponses },
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
      if (!item) {
        return reply.status(404).send(problemDetail({
          type: "https://api.aicfo.com.br/errors/action-item-not-found",
          title: "Item não encontrado",
          status: 404,
          instance: req.url,
          requestId: randomUUID(),
        }));
      }

      const updated = await db.actionPlanItem.update({
        where: { id: item.id },
        data: { clientApproved: req.body.approved, clientComment: req.body.comment ?? null },
      });
      return reply.send({ id: updated.id });
    },
  });

  // Lifecycle de status do item de ação — sinal de validação para self-harness (ADR-011 Etapa 2)
  f.patch("/actions/:itemId/status", {
    schema: {
      params: z.object({ itemId: z.string().uuid() }),
      body: z.object({
        status: z.enum(["pending", "in_progress", "blocked", "done", "abandoned"]),
        reason: z.string().max(500).optional(),
      }),
      response: {
        200: z.object({ id: z.string(), status: z.string() }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("shadow", "assisted", "autonomous")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const item = await db.actionPlanItem.findFirst({
        where: {
          id: req.params.itemId,
          analysis: { tenantId: req.auth!.tenantId },
        },
      });
      if (!item) {
        return reply.status(404).send(problemDetail({
          type: "https://api.aicfo.com.br/errors/action-item-not-found",
          title: "Item não encontrado",
          status: 404,
          instance: req.url,
          requestId: randomUUID(),
        }));
      }

      const updated = await db.actionPlanItem.update({
        where: { id: item.id },
        data: {
          status: req.body.status,
          statusReason: req.body.reason ?? null,
          lastStatusUpdatedAt: new Date(),
        },
      });
      return reply.send({ id: updated.id, status: updated.status });
    },
  });

  // Aprovação do mês (fecha a análise no modo ASSISTED)
  f.post("/analysis/:analysisId/approve", {
    schema: {
      params: z.object({ analysisId: z.string().uuid() }),
      response: {
        200: z.object({ status: z.string(), approvedAt: z.string() }),
        ...defaultErrorResponses,
      },
    },
    preHandler: [requireAuth, requireMode("assisted")],
    handler: async (req, reply) => {
      const db = getPrisma();
      const analysis = await db.monthlyAnalysis.findFirst({
        where: { id: req.params.analysisId, tenantId: req.auth!.tenantId },
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
