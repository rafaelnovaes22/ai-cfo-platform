import { runNarrativeSynthesisAgentWithTelemetry } from "@/monthly-analysis/agents/narrative-synthesis.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Skip se não há entradas normalizadas — sem dados, sem narrativa.
// Caso contrário, requer dre + marginDiagnosis + cashflowRisk preenchidos.
export async function narrativeSynthesisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  if (!state.normalizedEntries || state.normalizedEntries.length === 0) {
    return { narrativeCards: [] };
  }
  if (!state.dre || !state.marginDiagnosis || !state.cashflowRisk) {
    throw new Error(
      "narrative_synthesis: precondição violada — dre/marginDiagnosis/cashflowRisk ausentes",
    );
  }
  const input = {
    dre: state.dre,
    anomalies: state.anomalies ?? [],
    marginDiagnosis: state.marginDiagnosis,
    cashflowRisk: state.cashflowRisk,
    segment: state.segment,
    taxRegime: state.taxRegime,
    toneOfVoice: state.toneOfVoice,
  };
  const { data, response, latencyMs } = await runNarrativeSynthesisAgentWithTelemetry(input, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  const { costs, traces } = buildAgentTelemetry({
    agent: "narrative-synthesis",
    response,
    latencyMs,
    inputPayload: input,
    outputPayload: data,
  });

  return { narrativeCards: data, costs, traces };
}
