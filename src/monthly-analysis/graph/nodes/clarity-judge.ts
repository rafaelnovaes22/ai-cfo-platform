import { runClarityJudgeAgentWithTelemetry } from "@/monthly-analysis/agents/classification.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { JudgeInput } from "@/classification/judge.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function clarityJudgeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const inputs: JudgeInput[] = (state.normalizedEntries ?? []).map((entry) => ({
    entryId: entry.entryId,
    description: entry.normalizedDescription,
  }));

  const { data, response, latencyMs } = await runClarityJudgeAgentWithTelemetry(inputs, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  const { costs, traces } = buildAgentTelemetry({
    agent: "clarity-judge",
    response,
    latencyMs,
    inputPayload: inputs,
    outputPayload: data,
  });

  return { clarityResults: data, costs, traces };
}
