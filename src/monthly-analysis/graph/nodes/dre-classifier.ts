import {
  applyClarityCaps,
  runDreClassificationAgent,
} from "@/monthly-analysis/agents/classification.js";
import type { EntryForClassification } from "@/classification/prompts.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function dreClassifierNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const inputs: EntryForClassification[] = (state.normalizedEntries ?? []).map((entry) => ({
    entryId: entry.entryId,
    date: entry.date,
    description: entry.normalizedDescription,
    amountCents: entry.amountCents,
    direction: entry.direction,
  }));
  const classifications = await runDreClassificationAgent(inputs, { tenantId: state.tenantId });
  const finalClassifications =
    state.clarityResults && state.clarityResults.length > 0
      ? applyClarityCaps(classifications, state.clarityResults)
      : classifications;
  return { classifiedEntries: finalClassifications };
}
