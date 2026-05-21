import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { DreLines } from "@/dre-narrative/aggregator.js";

let _redis: IORedis | null = null;

function getRedis(): IORedis {
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

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

// ── Classification ─────────────────────────────────────────────────────────

let _classificationQueue: Queue | null = null;

export interface ClassificationJob { analysisId: string; tenantId: string; traceId?: string }

export function getClassificationQueue(): Queue {
  if (!_classificationQueue) {
    _classificationQueue = new Queue("classification", { connection: getRedis() });
  }
  return _classificationQueue;
}

export async function enqueueClassification(job: ClassificationJob): Promise<void> {
  await getClassificationQueue().add("classify", job, JOB_OPTIONS);
}

// ── DRE Narrative ──────────────────────────────────────────────────────────

let _dreNarrativeQueue: Queue | null = null;

export interface DreNarrativeJob { analysisId: string; tenantId: string; traceId?: string }

export function getDreNarrativeQueue(): Queue {
  if (!_dreNarrativeQueue) {
    _dreNarrativeQueue = new Queue("dre-narrative", { connection: getRedis() });
  }
  return _dreNarrativeQueue;
}

export async function enqueueDreNarrative(job: DreNarrativeJob): Promise<void> {
  await getDreNarrativeQueue().add("narrate", job, JOB_OPTIONS);
}

// ── Action Plan ────────────────────────────────────────────────────────────

let _actionPlanQueue: Queue | null = null;

export interface ActionPlanJob { analysisId: string; tenantId: string; dre: DreLines; traceId?: string }

export function getActionPlanQueue(): Queue {
  if (!_actionPlanQueue) {
    _actionPlanQueue = new Queue("action-plan", { connection: getRedis() });
  }
  return _actionPlanQueue;
}

export async function enqueueActionPlan(job: ActionPlanJob): Promise<void> {
  await getActionPlanQueue().add("plan", job, JOB_OPTIONS);
}
