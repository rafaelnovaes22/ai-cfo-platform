import { runClarityJudgeAgent } from "@/monthly-analysis/agents/classification.js";
import type { JudgeInput } from "@/classification/judge.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function clarityJudgeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const inputs: JudgeInput[] = (state.normalizedEntries ?? []).map((entry) => ({
    entryId: entry.entryId,
    description: entry.normalizedDescription,
  }));
  const clarityResults = await runClarityJudgeAgent(inputs, { tenantId: state.tenantId });
  return { clarityResults };
}
