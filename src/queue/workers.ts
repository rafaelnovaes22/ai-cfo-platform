import { Worker } from "bullmq";
import IORedis from "ioredis";
import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { MonthlyAnalysisGraphJob, EvalContinuousJob, WhatsappRetentionJob, AnalysisReaperJob } from "@/queue/index.js";
import { scheduleWhatsappRetention, scheduleEvalContinuous, scheduleAnalysisReaper, logQueueBacklog } from "@/queue/index.js";
import { startSelfHarnessWorker } from "@/learning/self-harness-worker.js";
import { runEvalContinuous } from "@/learning/eval-continuous.js";
import { purgeExpiredMessages } from "@/channels/whatsapp/message-log.js";
import { reapStuckAnalyses } from "@/queue/reaper.js";

// Teto de wall-clock do job inteiro do grafo. Cada chamada LLM já tem seu próprio
// timeout (LLM_TIMEOUT_MS), mas a cadeia serial de nós ou um await não-LLM travado
// poderia manter o job `active` indefinidamente. Estourado o teto, o job rejeita →
// handler `failed` → markAnalysisFailedIfExhausted, garantindo estado terminal.
const DEFAULT_GRAPH_JOB_TIMEOUT_MS = 10 * 60_000;

function resolveGraphJobTimeoutMs(): number {
  const raw = Number(process.env.GRAPH_JOB_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GRAPH_JOB_TIMEOUT_MS;
}

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
// para não deixá-la presa em 'generating' nem escondida em 'pending'.
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
  const graphWorker = new Worker<MonthlyAnalysisGraphJob>(
    "monthly-analysis-graph",
    async (job) => {
      logger.info(
        { jobId: job.id, analysisId: job.data.analysisId, tenantId: job.data.tenantId },
        "LangGraph monthly-analysis: iniciando",
      );
      const graph = buildMonthlyAnalysisGraph();
      const timeoutMs = resolveGraphJobTimeoutMs();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`graph_job_timeout: análise ${job.data.analysisId} excedeu ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
      try {
        await Promise.race([
          graph.invoke({
            analysisId: job.data.analysisId,
            tenantId: job.data.tenantId,
            traceId: job.data.traceId,
            costs: [],
            traces: [],
            errors: [],
          }),
          timeout,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    { connection: getWorkerRedis(), concurrency: Number(process.env.WORKER_CONCURRENCY_GRAPH ?? 2) },
  );

  graphWorker.on("completed", (job) =>
    logger.info({ jobId: job.id, analysisId: job.data.analysisId }, "LangGraph monthly-analysis: concluído"),
  );
  graphWorker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, analysisId: job?.data.analysisId, err }, "LangGraph monthly-analysis: falhou");
    await markAnalysisFailedIfExhausted(job, "LangGraph");
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

  const analysisReaperWorker = new Worker<AnalysisReaperJob>(
    "analysis-reaper",
    async () => {
      const reaped = await reapStuckAnalyses();
      if (reaped > 0) logger.info({ reaped }, "analysis-reaper: ciclo concluído");
      // Observabilidade de fila (Gate 1.5): aproveita o ciclo de 5min para logar o backlog.
      await logQueueBacklog();
    },
    { connection: getWorkerRedis(), concurrency: 1 },
  );

  analysisReaperWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "analysis-reaper: job falhou");
  });

  // Agenda os jobs repetíveis (idempotentes — jobId singleton).
  void scheduleWhatsappRetention().catch((err) =>
    logger.error({ err }, "whatsapp-retention: falha ao agendar job repetível"),
  );
  void scheduleEvalContinuous().catch((err) =>
    logger.error({ err }, "eval-continuous: falha ao agendar job repetível"),
  );
  void scheduleAnalysisReaper().catch((err) =>
    logger.error({ err }, "analysis-reaper: falha ao agendar job repetível"),
  );

  logger.info("Workers BullMQ iniciados: [monthly-analysis-graph, self-harness, eval-continuous, whatsapp-retention, analysis-reaper]");
}
