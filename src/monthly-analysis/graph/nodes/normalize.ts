import { runNormalizationAgentWithTelemetry } from "@/monthly-analysis/agents/normalization.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function normalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const rawEntries = state.rawEntries ?? [];
  const { data, response, latencyMs } = await runNormalizationAgentWithTelemetry(rawEntries, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  const { costs, traces } = buildAgentTelemetry({
    agent: "normalization",
    response,
    latencyMs,
    inputPayload: rawEntries,
    outputPayload: data,
  });

  return { normalizedEntries: data, costs, traces };
}
