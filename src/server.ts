import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { logger } from "@/observability/logger.js";
import rawBody from "fastify-raw-body";
import { authRoutes } from "@/auth/routes.js";
import { workspaceRoutes } from "@/workspace/routes.js";
import { billingRoutes } from "@/billing/routes.js";
import { tenantConfigRoutes } from "@/tenant-config/routes.js";
import { ingestRoutes } from "@/ingest/routes.js";
import { classificationRoutes } from "@/classification/routes.js";
import { dreNarrativeRoutes } from "@/dre-narrative/routes.js";
import { actionPlanRoutes } from "@/action-plan/routes.js";
import { hubRoutes } from "@/hub/routes.js";
import { exportRoutes } from "@/export/routes.js";
import { startWorkers } from "@/queue/workers.js";
import { disconnectPrisma } from "@/persistence/prisma.js";
import { flushLangfuse } from "@/observability/langfuse.js";

const port = Number(process.env.PORT ?? 3000);

const app = Fastify({
  loggerInstance: logger,
  trustProxy: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// req.auth populado por requireAuth nas rotas protegidas (null por padrão)
// rawBody necessário para verificação de assinatura do webhook Stripe
await app.register(rawBody, { global: false, encoding: false, runFirst: true });

app.decorateRequest("auth", null);

// Erros de negócio (4xx) passam a mensagem; 5xx são opacos
app.setErrorHandler(async (err, _req, reply) => {
  if ("statusCode" in err && typeof err.statusCode === "number" && err.statusCode < 500) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  logger.error({ err }, "Erro interno");
  return reply.status(500).send({ message: "Erro interno do servidor" });
});

app.get("/health", async () => ({
  status: "ok",
  service: "aicfo",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
}));

await app.register(authRoutes);
await app.register(workspaceRoutes);
await app.register(billingRoutes);
await app.register(tenantConfigRoutes);
await app.register(ingestRoutes);
await app.register(classificationRoutes);
await app.register(dreNarrativeRoutes);
await app.register(actionPlanRoutes);
await app.register(hubRoutes);
await app.register(exportRoutes);

startWorkers();

const shutdown = async (): Promise<void> => {
  logger.info("Encerrando servidor...");
  await app.close();
  await disconnectPrisma();
  await flushLangfuse();
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

const start = async (): Promise<void> => {
  try {
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`Aicfo listening on :${port}`);
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
};

void start();
