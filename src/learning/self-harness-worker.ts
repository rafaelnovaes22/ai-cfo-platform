import { Worker } from "bullmq";
import IORedis from "ioredis";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { HarnessJob, HarnessJobCorrected, HarnessJobValidated } from "@/queue/index.js";
import { evaluateAutonomyGate, updateTenantAutonomy } from "@/learning/autonomy-gate.js";

function createRedisForWorker(): IORedis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  // Railway private network uses IPv6-only hostnames (*.railway.internal).
  // Workers require maxRetriesPerRequest: null to avoid BullMQ blocking issues.
  const isRailwayInternal = url.includes(".railway.internal");
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    ...(isRailwayInternal ? { family: 6 } : {}),
  });
}

function resolveConfidenceBand(confidence: number | null): string | null {
  if (confidence === null) return null;
  return confidence >= 0.85 ? "easy" : "hard";
}

export async function handleClassificationCorrected(data: HarnessJobCorrected): Promise<void> {
  const db = getPrisma();
  const now = new Date().toISOString();

  await db.$transaction([
    db.tenantMemoryItem.create({
      data: {
        tenantId: data.tenantId,
        kind: "fact",
        content: {
          description: data.description,
          category: data.correctedCategory,
          originalPrediction: data.predictedCategory ?? null,
          source: "client_correction",
        },
        confidence: 1.0,
        evidenceRefs: [
          {
            source: "ledger_entry",
            refId: data.entryId,
            observedAt: now,
          },
        ],
      },
    }),
    db.validationMetric.create({
      data: {
        tenantId: data.tenantId,
        agentName: "classification",
        signal: "negative",
        refType: "ledger_entry",
        refId: data.entryId,
        confidenceBand: resolveConfidenceBand(data.confidence),
      },
    }),
  ]);

  logger.info(
    { tenantId: data.tenantId, entryId: data.entryId },
    "self-harness: classification.corrected processado",
  );

  // Reavalia gate de autonomia após cada sinal negativo (ADR-011 §3 — auto-rebaixamento)
  const newLevel = await evaluateAutonomyGate(data.tenantId, "classification");
  await updateTenantAutonomy(data.tenantId, "classification", newLevel);
}

export async function handleClassificationValidated(data: HarnessJobValidated): Promise<void> {
  const db = getPrisma();

  await db.validationMetric.create({
    data: {
      tenantId: data.tenantId,
      agentName: "classification",
      signal: "positive",
      refType: "ledger_entry",
      refId: data.entryId,
      confidenceBand: resolveConfidenceBand(data.confidence),
    },
  });

  logger.info(
    { tenantId: data.tenantId, entryId: data.entryId },
    "self-harness: classification.validated processado",
  );

  // Reavalia gate de autonomia após cada sinal positivo (ADR-011 §3 — promoção automática)
  const newLevel = await evaluateAutonomyGate(data.tenantId, "classification");
  await updateTenantAutonomy(data.tenantId, "classification", newLevel);
}

export function startSelfHarnessWorker(): Worker<HarnessJob> {
  const worker = new Worker<HarnessJob>(
    "self-harness",
    async (job) => {
      if (job.data.type === "classification.corrected") {
        await handleClassificationCorrected(job.data as HarnessJobCorrected);
      } else if (job.data.type === "classification.validated") {
        await handleClassificationValidated(job.data as HarnessJobValidated);
      }
    },
    {
      connection: createRedisForWorker(),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, type: job?.data?.type, err }, "self-harness: job falhou");
  });

  return worker;
}
