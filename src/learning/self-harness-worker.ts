import { Worker } from "bullmq";
import IORedis from "ioredis";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { HarnessJob, HarnessJobCorrected, HarnessJobValidated } from "@/queue/index.js";
import { evaluateAutonomyGate, updateTenantAutonomy } from "@/learning/autonomy-gate.js";
import { checkAndPromoteToGlobal } from "@/learning/global-signal-promoter.js";
import { isDiscriminativeDescription } from "@/classification/rule-classifier.js";

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

  // Descrição genérica ("Pagamento", "TED 500", "PIX") não é transferível: memorizá-la
  // como fact faz o flywheel reaplicar a categoria a QUALQUER lançamento com a mesma
  // descrição genérica, com confiança 1.0 — falsa certeza. O sinal negativo (métrica e
  // gate de autonomia) continua valendo; só a memória/promoção global é pulada.
  const memorizable = isDiscriminativeDescription(data.description);

  const metricOp = db.validationMetric.create({
    data: {
      tenantId: data.tenantId,
      agentName: "classification",
      signal: "negative",
      refType: "ledger_entry",
      refId: data.entryId,
      confidenceBand: resolveConfidenceBand(data.confidence),
    },
  });
  const factOp = db.tenantMemoryItem.create({
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
      evidenceRefs: [{ source: "ledger_entry", refId: data.entryId, observedAt: now }],
    },
  });
  const ops: Prisma.PrismaPromise<unknown>[] = memorizable ? [factOp, metricOp] : [metricOp];
  await db.$transaction(ops);

  logger.info(
    { tenantId: data.tenantId, entryId: data.entryId, memorizedFact: memorizable },
    "self-harness: classification.corrected processado",
  );

  // Promoção ao pool global só para descrição discriminativa (ADR-011 §2) — genérica
  // não vira sinal global pelo mesmo motivo que não vira fact de tenant.
  if (memorizable) {
    await checkAndPromoteToGlobal(data.tenantId, data.segment, data.description, data.correctedCategory);
  }

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
