import { assessCashflowRisk } from "@/monthly-analysis/agents/financial-diagnosis.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Avalia risco de caixa com limitações explícitas
// quando faltarem dados (insufficient_data).
export async function cashflowRiskNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  return { cashflowRisk: assessCashflowRisk(state.normalizedEntries) };
}
