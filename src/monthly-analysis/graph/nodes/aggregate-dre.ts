import { aggregateDre } from "@/dre-narrative/aggregator.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Determinístico — sem LLM. Combina entries normalizadas + classificações
// em DreLines (totais, margens). Reusa aggregator do pipeline legacy.
export async function aggregateDreNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const classificationsById = new Map(
    (state.classifiedEntries ?? []).map((c) => [c.entryId, c.category]),
  );

  const rows = (state.normalizedEntries ?? []).map((entry) => ({
    amountCents: entry.amountCents,
    direction: entry.direction,
    predictedCategory: classificationsById.get(entry.entryId) ?? null,
    confirmedCategory: null,
  }));

  return { dre: aggregateDre(rows) };
}
