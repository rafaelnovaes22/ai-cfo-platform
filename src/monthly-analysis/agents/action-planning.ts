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

  return parseAgentJson(response.content, ActionPlanDraftSchema);
}
