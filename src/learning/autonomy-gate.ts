// ADR-011 §3 — Gate de autonomia: 95% estratificado por confiança.
// C8: nenhum if(tenantId) — toda lógica é data-driven sobre ValidationMetric.
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

export type AgentName = "classification" | "narrative-synthesis" | "action-planning";
export type AutonomyLevel = "needs_review" | "autonomous";

// Chave usada em learningAutonomyState por agente
const AGENT_STATE_KEY: Record<AgentName, string> = {
  classification: "classification",
  "narrative-synthesis": "narrative",
  "action-planning": "action",
};

const GATE_WINDOW = 30;       // últimas N validações com sinal (nulos não contam)
const GATE_THRESHOLD = 0.95;  // 95% de positivos

// Para classification: ambas as faixas (easy + hard) devem ter ≥30 amostras e ≥95% positivos.
async function computeClassificationGate(tenantId: string): Promise<AutonomyLevel> {
  const db = getPrisma();

  const [easyMetrics, hardMetrics] = await Promise.all([
    db.validationMetric.findMany({
      where: { tenantId, agentName: "classification", confidenceBand: "easy" },
      orderBy: { observedAt: "desc" },
      take: GATE_WINDOW,
      select: { signal: true },
    }),
    db.validationMetric.findMany({
      where: { tenantId, agentName: "classification", confidenceBand: "hard" },
      orderBy: { observedAt: "desc" },
      take: GATE_WINDOW,
      select: { signal: true },
    }),
  ]);

  if (easyMetrics.length < GATE_WINDOW || hardMetrics.length < GATE_WINDOW) {
    return "needs_review"; // cold start — amostras insuficientes em alguma faixa
  }

  const easyRate = easyMetrics.filter((m) => m.signal === "positive").length / GATE_WINDOW;
  const hardRate = hardMetrics.filter((m) => m.signal === "positive").length / GATE_WINDOW;

  return easyRate >= GATE_THRESHOLD && hardRate >= GATE_THRESHOLD ? "autonomous" : "needs_review";
}

// Para narrative-synthesis e action-planning: agregado (sem estratificação por confiança).
async function computeAggregateGate(tenantId: string, agentName: AgentName): Promise<AutonomyLevel> {
  const db = getPrisma();

  const metrics = await db.validationMetric.findMany({
    where: { tenantId, agentName },
    orderBy: { observedAt: "desc" },
    take: GATE_WINDOW,
    select: { signal: true },
  });

  if (metrics.length < GATE_WINDOW) {
    return "needs_review";
  }

  const positiveRate = metrics.filter((m) => m.signal === "positive").length / GATE_WINDOW;
  return positiveRate >= GATE_THRESHOLD ? "autonomous" : "needs_review";
}

export async function evaluateAutonomyGate(
  tenantId: string,
  agentName: AgentName,
): Promise<AutonomyLevel> {
  if (agentName === "classification") {
    return computeClassificationGate(tenantId);
  }
  return computeAggregateGate(tenantId, agentName);
}

// Persiste o novo nível em learningAutonomyState e emite log de promoção/rebaixamento.
export async function updateTenantAutonomy(
  tenantId: string,
  agentName: AgentName,
  newLevel: AutonomyLevel,
): Promise<void> {
  const db = getPrisma();

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { learningAutonomyState: true },
  });

  if (!tenant) return;

  const current = (tenant.learningAutonomyState as Record<string, string>) ?? {};
  const stateKey = AGENT_STATE_KEY[agentName];
  const previousLevel = current[stateKey] as AutonomyLevel | undefined;

  if (previousLevel === newLevel) return;

  await db.tenant.update({
    where: { id: tenantId },
    data: { learningAutonomyState: { ...current, [stateKey]: newLevel } },
  });

  if (previousLevel === "autonomous" && newLevel === "needs_review") {
    logger.warn(
      { tenantId, agentName, previousLevel, newLevel },
      "autonomy-gate: agente REBAIXADO para needs_review — eficácia caiu abaixo de 95%",
    );
  } else {
    logger.info(
      { tenantId, agentName, previousLevel, newLevel },
      "autonomy-gate: agente PROMOVIDO para autonomous — gate de 95% atingido",
    );
  }
}
