import Fastify from "fastify";
import { logger } from "@/observability/logger.js";

const port = Number(process.env.PORT ?? 3000);

const app = Fastify({
  loggerInstance: logger,
  trustProxy: true,
});

app.get("/health", async () => ({
  status: "ok",
  service: "aicfo",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
}));

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
