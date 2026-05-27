import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
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

// Rate limiting global: protege contra abuso e ataques de força bruta.
// Rotas de auth têm limite próprio mais restrito (ver auth/routes.ts).
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  timeWindow: "1 minute",
  keyGenerator: (req) => req.ip,
  skipOnError: true,
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    message: `Limite de requisições atingido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
  }),
});

// CORS: lê FRONTEND_ORIGIN do .env (vírgula para múltiplas origens).
// Em Railway sem FRONTEND_ORIGIN configurado, aceita qualquer *.up.railway.app.
// Em dev, fallback para localhost:5173.
function buildCorsOrigins(): (string | RegExp)[] {
  const env = process.env.FRONTEND_ORIGIN;
  if (env) return env.split(",").map((o) => o.trim()).filter(Boolean);
  if (process.env.RAILWAY_ENVIRONMENT) {
    return ["http://localhost:5173", /^https:\/\/.*\.up\.railway\.app$/];
  }
  return ["http://localhost:5173"];
}
await app.register(cors, {
  origin: buildCorsOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  exposedHeaders: ["x-request-id"],
});

// OpenAPI spec (servida em /openapi.json) — derivada dos schemas Zod via jsonSchemaTransform.
// Swagger UI fica em /docs para inspeção manual durante desenvolvimento.
await app.register(swagger, {
  openapi: {
    info: {
      title: "Aicfo API",
      description:
        "Backend Aicfo (CFO-IA para PMEs). SKU piloto: monthly-analysis. " +
        "Auth: Bearer JWT em Authorization. Tokens API: prefixo sap_.",
      version: "0.1.0",
    },
    servers: [{ url: process.env.PUBLIC_API_URL ?? `http://localhost:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  transform: jsonSchemaTransform,
});
app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "list", deepLinking: true },
});

// req.auth populado por requireAuth nas rotas protegidas (null por padrão)
// rawBody necessário para verificação de assinatura do webhook Stripe
await app.register(rawBody, { global: false, encoding: false, runFirst: true });

app.decorateRequest("auth", null);

// Erros de negócio (4xx) passam a mensagem; 5xx são opacos.
// `err` é declarado como FastifyError pelo Fastify; tratamos como `unknown` por segurança.
app.setErrorHandler(async (err: unknown, _req, reply) => {
  const isErrorLike = (e: unknown): e is { statusCode?: number; message?: string } =>
    typeof e === "object" && e !== null;
  if (isErrorLike(err) && typeof err.statusCode === "number" && err.statusCode < 500) {
    return reply.status(err.statusCode).send({ message: err.message ?? "Erro" });
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
