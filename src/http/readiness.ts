import { getPrisma } from "@/persistence/prisma.js";
import { getMonthlyAnalysisQueueDepth, type QueueDepth } from "@/queue/index.js";
import { logger } from "@/observability/logger.js";

// Readiness check para escala (Gate 1.4). Distingue-se do /health (liveness):
// liveness só diz que o processo está vivo e é o que o Railway usa para restart —
// fazê-lo depender de DB/Redis causaria restart storm justamente sob carga. O
// readiness verifica as dependências e expõe o backlog da fila; um monitor
// externo/LB pode usá-lo sem derrubar o processo.

export interface ReadinessReport {
  ready: boolean;
  checks: { db: boolean; redis: boolean };
  queue: QueueDepth | null;
  timestamp: string;
}

const CHECK_TIMEOUT_MS = 2000;

async function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`readiness_timeout: ${label}`)), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkReadiness(): Promise<ReadinessReport> {
  let db = false;
  let redis = false;
  let queue: QueueDepth | null = null;

  try {
    await withTimeout(getPrisma().$queryRaw`SELECT 1`, "db");
    db = true;
  } catch (err) {
    logger.warn({ err }, "readiness: DB indisponível");
  }

  try {
    queue = await withTimeout(getMonthlyAnalysisQueueDepth(), "redis");
    redis = true;
  } catch (err) {
    logger.warn({ err }, "readiness: Redis/fila indisponível");
  }

  return {
    ready: db && redis,
    checks: { db, redis },
    queue,
    timestamp: new Date().toISOString(),
  };
}
