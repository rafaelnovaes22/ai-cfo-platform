import { Queue } from "bullmq";
import IORedis from "ioredis";

let _redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null, // obrigatório para BullMQ
    });
  }
  return _redis;
}

// Fila de classificação — processada pelo módulo `classification` (Onda 1)
let _classificationQueue: Queue | null = null;

export function getClassificationQueue(): Queue {
  if (!_classificationQueue) {
    _classificationQueue = new Queue("classification", { connection: getRedis() });
  }
  return _classificationQueue;
}

export interface ClassificationJob {
  analysisId: string;
  tenantId: string;
}

export async function enqueueClassification(job: ClassificationJob): Promise<void> {
  await getClassificationQueue().add("classify", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });
}
