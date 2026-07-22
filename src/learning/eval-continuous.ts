// ADR-011 §7 — Eval contínuo: scan periódico de drift por tenant.
// Reavalia todos os agentes de todos os tenants e atualiza learningAutonomyState.
// Disparado por job BullMQ (eval-continuous) ou chamada direta.
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import {
  evaluateAutonomyGate,
  updateTenantAutonomy,
  type AgentName,
  type AutonomyLevel,
} from "@/learning/autonomy-gate.js";

const AGENT_NAMES: AgentName[] = ["classification", "narrative-synthesis", "action-planning"];

const AGENT_STATE_KEY: Record<AgentName, string> = {
  classification: "classification",
  "narrative-synthesis": "narrative",
  "action-planning": "action",
};

export interface EvalChange {
  tenantId: string;
  agentName: AgentName;
  previous: AutonomyLevel;
  current: AutonomyLevel;
}

export interface EvalContinuousReport {
  tenantsChecked: number;
  agentsEvaluated: number;
  promotions: number;
  demotions: number;
  changes: EvalChange[];
}

// Escaneia todos os tenants, reavalia cada agente e corrige learningAutonomyState se necessário.
// Idempotente: pode ser rodado repetidamente sem efeitos colaterais além de logs.
export async function runEvalContinuous(): Promise<EvalContinuousReport> {
  const db = getPrisma();

  const tenants = await db.tenant.findMany({
    select: { id: true, learningAutonomyState: true },
  });

  const report: EvalContinuousReport = {
    tenantsChecked: tenants.length,
    agentsEvaluated: 0,
    promotions: 0,
    demotions: 0,
    changes: [],
  };

  for (const tenant of tenants) {
    const state = (tenant.learningAutonomyState as Record<string, string>) ?? {};

    for (const agentName of AGENT_NAMES) {
      const stateKey = AGENT_STATE_KEY[agentName];
      const previousLevel = (state[stateKey] ?? "needs_review") as AutonomyLevel;

      const currentLevel = await evaluateAutonomyGate(tenant.id, agentName);
      report.agentsEvaluated++;

      if (currentLevel !== previousLevel) {
        await updateTenantAutonomy(tenant.id, agentName, currentLevel);
        report.changes.push({ tenantId: tenant.id, agentName, previous: previousLevel, current: currentLevel });

        if (currentLevel === "autonomous") {
          report.promotions++;
        } else {
          report.demotions++;
        }
      }
    }
  }

  if (report.changes.length > 0) {
    logger.warn(
      { promotions: report.promotions, demotions: report.demotions, changes: report.changes.length },
      "eval-continuous: mudanças de estado detectadas",
    );
  }

  logger.info(
    {
      tenantsChecked: report.tenantsChecked,
      agentsEvaluated: report.agentsEvaluated,
      promotions: report.promotions,
      demotions: report.demotions,
    },
    "eval-continuous: scan concluído",
  );

  return report;
}
