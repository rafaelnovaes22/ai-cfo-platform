import { Worker } from "bullmq";
import IORedis from "ioredis";
import { classifyAnalysis } from "@/classification/classifier.js";
import { generateDreNarrative } from "@/dre-narrative/narrator.js";
import { generateActionPlan } from "@/action-plan/generator.js";
import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { ClassificationJob, DreNarrativeJob, ActionPlanJob, MonthlyAnalysisGraphJob, EvalContinuousJob, WhatsappRetentionJob } from "@/queue/index.js";
import { scheduleWhatsappRetention, scheduleEvalContinuous } from "@/queue/index.js";
import { startSelfHarnessWorker } from "@/learning/self-harness-worker.js";
import { runEvalContinuous } from "@/learning/eval-continuous.js";
import { purgeExpiredMessages } from "@/channels/whatsapp/message-log.js";

let _redis: IORedis | null = null;

function getWorkerRedis(): IORedis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    // Railway private network uses IPv6-only hostnames (*.railway.internal).
    // Node's default DNS resolution prefers IPv4 even with family: 0, so force
    // family: 6 whenever the URL points to a Railway internal host. Local dev
    // (Docker Redis on localhost) keeps the default IPv4.
    const isRailwayInternal = url.includes(".railway.internal");
    _redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      ...(isRailwayInternal ? { family: 6 } : {}),
    });
  }
  return _redis;
}

// Marca a análise como 'failed' quando o job esgotou todas as tentativas BullMQ,
// para não deixá-la presa em 'generating' (legado) nem escondida em 'pending' (grafo).
async function markAnalysisFailedIfExhausted(
  job: { id?: string; data: { analysisId: string }; attemptsMade: number; opts: { attempts?: number } } | undefined,
  label: string,
): Promise<void> {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  try {
    await getPrisma().monthlyAnalysis.update({
      where: { id: job.data.analysisId },
      data: { status: "failed" },
    });
    logger.warn({ jobId: job.id, analysisId: job.data.analysisId }, `${label}: análise marcada como failed (tentativas esgotadas)`);
  } catch (updateErr) {
    logger.error({ jobId: job.id, updateErr }, `${label}: falha ao marcar status failed`);
  }
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
      concurrency: Number(process.env.WORKER_CONCURRENCY_CLASSIFICATION ?? 3),
    },
  );

  classificationWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Classificação concluída");
  });

  classificationWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, err }, "Classificação falhou");
    await markAnalysisFailedIfExhausted(job, "Classificação");
  });

  const dreNarrativeWorker = new Worker<DreNarrativeJob>(
    "dre-narrative",
    async (job) => {
      logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Gerando narrativa DRE");
      await generateDreNarrative(job.data.analysisId, job.data.tenantId);
    },
    { connection: getWorkerRedis(), concurrency: Number(process.env.WORKER_CONCURRENCY_NARRATIVE ?? 2) },
  );

  dreNarrativeWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Narrativa DRE concluída"),
  );
  dreNarrativeWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, err }, "Narrativa DRE falhou");
    await markAnalysisFailedIfExhausted(job, "Narrativa DRE");
  });

  const actionPlanWorker = new Worker<ActionPlanJob>(
    "action-plan",
    async (job) => {
      logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Gerando plano de ação");
      await generateActionPlan(job.data.analysisId, job.data.tenantId, job.data.dre);
    },
    { connection: getWorkerRedis(), concurrency: Number(process.env.WORKER_CONCURRENCY_ACTION ?? 2) },
  );

  actionPlanWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "Plano de ação gerado"),
  );
  actionPlanWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, err }, "Plano de ação falhou");
    await markAnalysisFailedIfExhausted(job, "Plano de ação");
  });

  const graphWorker = new Worker<MonthlyAnalysisGraphJob>(
    "monthly-analysis-graph",
    async (job) => {
      logger.info(
        { jobId: job.id, analysisId: job.data.analysisId, tenantId: job.data.tenantId },
        "LangGraph monthly-analysis: iniciando",
      );
      const graph = buildMonthlyAnalysisGraph();
      await graph.invoke({
        analysisId: job.data.analysisId,
        tenantId: job.data.tenantId,
        traceId: job.data.traceId,
        costs: [],
        traces: [],
        errors: [],
      });
    },
    { connection: getWorkerRedis(), concurrency: Number(process.env.WORKER_CONCURRENCY_GRAPH ?? 2) },
  );

  graphWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "LangGraph monthly-analysis: concluído"),
  );
  graphWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, analysisId: job?.data.analysisId, err }, "LangGraph monthly-analysis: falhou");
    // Quando BullMQ esgota todas as tentativas, marca a análise como 'failed' para
    // evitar que fique presa em "generating" e para que o erro fique visível ao usuário.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        await getPrisma().monthlyAnalysis.update({
          where: { id: job.data.analysisId },
          data: { status: "failed" },
        });
        logger.warn({ jobId: job.id, analysisId: job.data.analysisId }, "LangGraph: análise marcada como failed após esgotar tentativas");
      } catch (updateErr) {
        logger.error({ jobId: job.id, updateErr }, "Falha ao atualizar status para failed");
      }
    }
  });

  startSelfHarnessWorker();

  const evalContinuousWorker = new Worker<EvalContinuousJob>(
    "eval-continuous",
    async (job) => {
      logger.info({ jobId: job.id }, "eval-continuous: iniciando scan de drift");
      const report = await runEvalContinuous();
      logger.info({ jobId: job.id, ...report }, "eval-continuous: scan finalizado");
    },
    { connection: getWorkerRedis(), concurrency: 1 },
  );

  evalContinuousWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "eval-continuous: job falhou");
  });

  const whatsappRetentionWorker = new Worker<WhatsappRetentionJob>(
    "whatsapp-retention",
    async () => {
      const removed = await purgeExpiredMessages();
      logger.info({ removed }, "whatsapp-retention: purge concluído");
    },
    { connection: getWorkerRedis(), concurrency: 1 },
  );

  whatsappRetentionWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "whatsapp-retention: job falhou");
  });

  // Agenda os jobs repetíveis (idempotentes — jobId singleton).
  void scheduleWhatsappRetention().catch((err) =>
    logger.error({ err }, "whatsapp-retention: falha ao agendar job repetível"),
  );
  void scheduleEvalContinuous().catch((err) =>
    logger.error({ err }, "eval-continuous: falha ao agendar job repetível"),
  );

  logger.info("Workers BullMQ iniciados: [classification, dre-narrative, action-plan, monthly-analysis-graph, self-harness, eval-continuous, whatsapp-retention]");
}
