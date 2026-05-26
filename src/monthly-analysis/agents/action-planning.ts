import { callLlm } from "@/llm/index.js";
import {
  ActionPlanDraftSchema,
  type ActionPlanDraft,
  type Anomaly,
  type CashflowRisk,
  type MarginDiagnosis,
  type NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/action-planning.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";

export interface ActionPlanningAgentInput {
  dre: DreLines;
  anomalies: Anomaly[];
  narrativeCards: NarrativeCardDraft[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
  toneOfVoice?: string;
}

const EFFORT_SCORE: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };
const RISK_SCORE: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };

export function sortShortsByRoi(plan: ActionPlanDraft): ActionPlanDraft {
  const shorts = plan.actions.filter((a) => a.horizon === "short");
  const rest = plan.actions.filter((a) => a.horizon !== "short");

  const sorted = [...shorts].sort((a, b) => {
    const roiA = a.impactCents / (EFFORT_SCORE[a.effortLevel] ?? 2);
    const roiB = b.impactCents / (EFFORT_SCORE[b.effortLevel] ?? 2);
    if (roiB !== roiA) return roiB - roiA;
    return (RISK_SCORE[a.riskLevel] ?? 2) - (RISK_SCORE[b.riskLevel] ?? 2);
  });

  return { ...plan, actions: [...sorted, ...rest] };
}

export async function runActionPlanningAgent(
  input: ActionPlanningAgentInput,
  options: MonthlyAgentRunOptions,
): Promise<ActionPlanDraft> {
  const response = await callLlm({
    task: "action-planning",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  return sortShortsByRoi(parseAgentJson(response.content, ActionPlanDraftSchema));
}
