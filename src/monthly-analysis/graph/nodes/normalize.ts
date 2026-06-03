import { runNormalizationAgentWithTelemetry } from "@/monthly-analysis/agents/normalization.js";
import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function normalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const rawEntries = state.rawEntries ?? [];
  // Lotes paralelos: normalização é por-lançamento, então dividir não muda o
  // resultado e corta o wall-clock no Vertex-SP (ver chunk-runner.ts).
  const { data, response, latencyMs } = await runChunkedWithTelemetry(
    rawEntries,
    { tenantId: state.tenantId, traceId: state.traceId },
    runNormalizationAgentWithTelemetry,
  );

  const { costs, traces } = buildAgentTelemetry({
    agent: "normalization",
    response,
    latencyMs,
    inputPayload: rawEntries,
    outputPayload: data,
  });

  return { normalizedEntries: data, costs, traces };
}
