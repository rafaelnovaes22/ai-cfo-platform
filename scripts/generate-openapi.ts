import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import swagger from "@fastify/swagger";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
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
import { cashflowRoutes } from "@/cashflow/routes.js";
import { whatsappWebhookRoutes } from "@/channels/whatsapp/webhook.js";
import { whatsappConfigRoutes } from "@/channels/whatsapp/config-routes.js";
import { whatsappMessagesRoutes } from "@/channels/whatsapp/messages-routes.js";

const port = 3000;

const app = Fastify({ logger: false });

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (req) => req.ip,
  skipOnError: true,
});

await app.register(cors, {
  origin: ["http://localhost:5173"],
  credentials: true,
});

await app.register(swagger, {
  openapi: {
    info: {
      title: "Aicfo API",
      description:
        "Backend Aicfo (CFO-IA para PMEs). SKU piloto: monthly-analysis. " +
        "Auth: Bearer JWT em Authorization. Tokens API: prefixo sap_.",
      version: "0.2.0",
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

await app.register(authRoutes);
await app.register(workspaceRoutes);
await app.register(billingRoutes);
await app.register(tenantConfigRoutes);
await app.register(classificationRoutes);

await app.register(async (web) => {
  await web.register(ingestRoutes);
  await web.register(dreNarrativeRoutes);
  await web.register(actionPlanRoutes);
  await web.register(hubRoutes);
  await web.register(exportRoutes);
  await web.register(cashflowRoutes);
});

await app.register(whatsappWebhookRoutes);
await app.register(whatsappConfigRoutes);
await app.register(whatsappMessagesRoutes);

await app.ready();
const spec = app.swagger();

const outDir = path.resolve(process.cwd(), "docs", "contracts");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "aicfo.openapi.json");
writeFileSync(outPath, JSON.stringify(spec, null, 2));

// eslint-disable-next-line no-console
console.log(`OpenAPI spec written to ${outPath}`);

await app.close();
