import { Worker } from "bullmq";
import IORedis from "ioredis";
import { classifyAnalysis } from "@/classification/classifier.js";
import { generateDreNarrative } from "@/dre-narrative/narrator.js";
import { generateActionPlan } from "@/action-plan/generator.js";
import { logger } from "@/observability/logger.js";
import type { ClassificationJob, DreNarrativeJob, ActionPlanJob } from "@/queue/index.js";

let _redis: IORedis | null = null;

function getWorkerRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      // Railway private network uses IPv6-only hostnames (*.railway.internal).
      // family: 0 lets DNS pick whichever stack is available (v4 locally, v6 on Railway).
      family: 0,
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

  const dreNarrativeWorker = new Worker<DreNarrativeJob>(
    "dre-narrative",
    async (job) => {
      logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Gerando narrativa DRE");
      await generateDreNarrative(job.data.analysisId, job.data.tenantId);
    },
    { connection: getWorkerRedis(), concurrency: 2 },
  );

  dreNarrativeWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Narrativa DRE concluída"),
  );
  dreNarrativeWorker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err }, "Narrativa DRE falhou"),
  );

  const actionPlanWorker = new Worker<ActionPlanJob>(
    "action-plan",
    async (job) => {
      logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Gerando plano de ação");
      await generateActionPlan(job.data.analysisId, job.data.tenantId, job.data.dre);
    },
    { connection: getWorkerRedis(), concurrency: 2 },
  );

  actionPlanWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Plano de ação gerado"),
  );
  actionPlanWorker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err }, "Plano de ação falhou"),
  );

  logger.info("Workers BullMQ iniciados: [classification, dre-narrative, action-plan]");
}
