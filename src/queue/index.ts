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

// ── Monthly Analysis Graph (LangGraph) ────────────────────────────────────
// Usado quando productConfig.monthlyAnalysis.orchestrator = "langgraph"
// ou MONTHLY_ANALYSIS_DEFAULT_ORCHESTRATOR=langgraph.
// Substitui a cadeia classification → dre-narrative → action-plan com pipeline unificado.

let _monthlyAnalysisGraphQueue: Queue | null = null;

export interface MonthlyAnalysisGraphJob { analysisId: string; tenantId: string; traceId?: string }

export function getMonthlyAnalysisGraphQueue(): Queue {
  if (!_monthlyAnalysisGraphQueue) {
    _monthlyAnalysisGraphQueue = new Queue("monthly-analysis-graph", { connection: getRedis() });
  }
  return _monthlyAnalysisGraphQueue;
}

export async function enqueueMonthlyAnalysisGraph(job: MonthlyAnalysisGraphJob): Promise<void> {
  await getMonthlyAnalysisGraphQueue().add("run-graph", job, JOB_OPTIONS);
}

// ── Self-Harness (ADR-011 Etapa 4) ────────────────────────────────────────

export type HarnessJobType = "classification.corrected" | "classification.validated";

export interface HarnessJobCorrected {
  type: "classification.corrected";
  tenantId: string;
  entryId: string;
  description: string;
  predictedCategory: string | null;
  correctedCategory: string;
  confidence: number | null;
  segment: string;
}

export interface HarnessJobValidated {
  type: "classification.validated";
  tenantId: string;
  entryId: string;
  confidence: number | null;
}

export type HarnessJob = HarnessJobCorrected | HarnessJobValidated;

let _selfHarnessQueue: Queue | null = null;

export function getSelfHarnessQueue(): Queue {
  if (!_selfHarnessQueue) {
    _selfHarnessQueue = new Queue("self-harness", { connection: getRedis() });
  }
  return _selfHarnessQueue;
}

export async function enqueueHarnessEvent(job: HarnessJob): Promise<void> {
  await getSelfHarnessQueue().add(job.type, job, JOB_OPTIONS);
}

// ── Eval Continuous (ADR-011 Etapa 7) ─────────────────────────────────────
// Job sem payload — scan completo de drift em todos os tenants.

export interface EvalContinuousJob {}

let _evalContinuousQueue: Queue | null = null;

export function getEvalContinuousQueue(): Queue {
  if (!_evalContinuousQueue) {
    _evalContinuousQueue = new Queue("eval-continuous", { connection: getRedis() });
  }
  return _evalContinuousQueue;
}

export async function enqueueEvalContinuous(): Promise<void> {
  await getEvalContinuousQueue().add("run", {}, {
    ...JOB_OPTIONS,
    jobId: "eval-continuous-singleton", // evita enfileirar duplicatas
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  });
}
