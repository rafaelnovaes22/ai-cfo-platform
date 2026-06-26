import { Queue } from "bullmq";
import IORedis from "ioredis";

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

// ── Monthly Analysis Graph (LangGraph) ────────────────────────────────────
// Orquestrador único do monthly-analysis (#180): 1 job roda o grafo inteiro
// (normalize → clarity → classification → diagnoses → narrative → plan → QA).
// A cadeia legada de 3 jobs (classification → dre-narrative → action-plan) foi removida.

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

// ── Analysis Reaper ───────────────────────────────────────────────────────
// Rede de segurança: marca como `failed` análises presas em `generating` além do
// teto (worker órfão sob carga não dispara o handler `failed`). Roda só no processo
// worker. Ver src/queue/reaper.ts.

export interface AnalysisReaperJob {}

let _analysisReaperQueue: Queue | null = null;

export function getAnalysisReaperQueue(): Queue {
  if (!_analysisReaperQueue) {
    _analysisReaperQueue = new Queue("analysis-reaper", { connection: getRedis() });
  }
  return _analysisReaperQueue;
}

export async function scheduleAnalysisReaper(): Promise<void> {
  await getAnalysisReaperQueue().add("reap", {}, {
    repeat: { pattern: "*/5 * * * *" }, // a cada 5 min
    jobId: "analysis-reaper-singleton",
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  });
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

// ── WhatsApp Message Retention (ADR-017) ──────────────────────────────────
// Job repetível diário que apaga mensagens do log com createdAt < now-180d.

export interface WhatsappRetentionJob {}

let _whatsappRetentionQueue: Queue | null = null;

export function getWhatsappRetentionQueue(): Queue {
  if (!_whatsappRetentionQueue) {
    _whatsappRetentionQueue = new Queue("whatsapp-retention", { connection: getRedis() });
  }
  return _whatsappRetentionQueue;
}

export async function scheduleWhatsappRetention(): Promise<void> {
  await getWhatsappRetentionQueue().add("purge", {}, {
    repeat: { pattern: "0 4 * * *" }, // diário às 04:00
    jobId: "whatsapp-retention-singleton",
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  });
}

// ── Eval Continuous (agendamento repetível) ───────────────────────────────
// O worker já existia, mas nada agendava o scan de drift (ADR-011) — rodava só
// se enfileirado manualmente. Agenda um run diário.

export async function scheduleEvalContinuous(): Promise<void> {
  await getEvalContinuousQueue().add("run", {}, {
    repeat: { pattern: "0 3 * * *", tz: "America/Sao_Paulo" }, // diário 03:00 BRT
    jobId: "eval-continuous-repeat",
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  });
}

// NOTA: o resumo diário proativo de caixa via WhatsApp foi intencionalmente NÃO
// agendado — o canal é reativo (responde a comandos e a extratos recebidos).
// Envio proativo é business-initiated (cobrado pela Meta) e foi descartado por
// decisão de produto (anti-spam + custo). Ver notification-service (dead code).
