import { aggregateDre, aggregateMonthlyRunRateDre } from "@/dre-narrative/aggregator.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Determinístico — sem LLM e sem decisão. Combina entries normalizadas +
// classificações em DreLines (totais, margens). Reusa aggregator do pipeline
// legacy. Não emite telemetria: é função pura de shape, não ponto de decisão.
export async function aggregateDreNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const classificationsById = new Map(
    (state.classifiedEntries ?? []).map((c) => [c.entryId, c.category]),
  );
  // Categoria confirmada na origem (PDF de DRE do contador): o aggregator a usa
  // com precedência sobre a predita (confirmedCategory ?? predictedCategory).
  const confirmedById = new Map(
    (state.rawEntries ?? [])
      .filter((r) => r.confirmedCategory != null && r.confirmedCategory !== "")
      .map((r) => [r.entryId, r.confirmedCategory as string]),
  );

  const rows = (state.normalizedEntries ?? []).map((entry) => ({
    amountCents: entry.amountCents,
    direction: entry.direction,
    month: entry.date.slice(0, 7),
    predictedCategory: classificationsById.get(entry.entryId) ?? null,
    confirmedCategory: confirmedById.get(entry.entryId) ?? null,
  }));

  // dre = total do período (exibido); monthlyDre = run-rate mensal por categoria
  // (mês típico) que alimenta narrativa/plano. Ver aggregateMonthlyRunRateDre.
  return { dre: aggregateDre(rows), monthlyDre: aggregateMonthlyRunRateDre(rows) };
}
