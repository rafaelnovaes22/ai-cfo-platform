import { runNormalizationAgent } from "@/monthly-analysis/agents/normalization.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function normalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const normalizedEntries = await runNormalizationAgent(state.rawEntries ?? [], {
    tenantId: state.tenantId,
  });
  return { normalizedEntries };
}
