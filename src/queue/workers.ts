import { Worker } from "bullmq";
import IORedis from "ioredis";
import { classifyAnalysis } from "@/classification/classifier.js";
import { logger } from "@/observability/logger.js";
import type { ClassificationJob } from "@/queue/index.js";

let _redis: IORedis | null = null;

function getWorkerRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

export function startWorkers(): void {
  const classificationWorker = new Worker<ClassificationJob>(
    "classification",
    async (job) => {
      logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Iniciando classificação");
      await classifyAnalysis(job.data.analysisId, job.data.tenantId);
    },
    {
      connection: getWorkerRedis(),
      concurrency: 3,
    },
  );

  classificationWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Classificação concluída");
  });

  classificationWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Classificação falhou");
  });

  logger.info("Workers BullMQ iniciados: [classification]");
}
