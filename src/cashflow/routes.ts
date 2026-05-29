import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "@/auth/middleware.js";
import { logger } from "@/observability/logger.js";
import { getCashflow, getCashflowSummaryDay } from "./service.js";
import {
  CashflowQuerySchema,
  CashflowSummaryQuerySchema,
  CashflowResponseSchema,
  CashflowSummaryDaySchema,
} from "./schema.js";

export const cashflowRoutes: FastifyPluginAsync = async (app) => {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.get("/cashflow", {
    schema: {
      querystring: CashflowQuerySchema,
      response: { 200: CashflowResponseSchema },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const requestId = randomUUID();
      const start = Date.now();

      try {
        const result = await getCashflow({
          tenantId: req.auth!.tenantId,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          granularity: req.query.granularity,
          category: req.query.category,
          requestId,
        });

        logger.info(
          { tenantId: req.auth!.tenantId, requestId, status: 200, latency_ms: Date.now() - start },
          "cashflow.request.end"
        );

        return reply.send(result);
      } catch (err) {
        logger.error(
          { tenantId: req.auth!.tenantId, requestId, errorClass: (err as Error).name, message: (err as Error).message },
          "cashflow.request.error"
        );
        throw err;
      }
    },
  });

  f.get("/cashflow/summary", {
    schema: {
      querystring: CashflowSummaryQuerySchema,
      response: { 200: CashflowSummaryDaySchema },
    },
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const requestId = randomUUID();
      const date = req.query.date ?? new Date().toISOString().slice(0, 10);

      const result = await getCashflowSummaryDay({
        tenantId: req.auth!.tenantId,
        date,
        requestId,
      });

      return reply.send(result);
    },
  });
};
