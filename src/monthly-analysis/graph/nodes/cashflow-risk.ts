import { assessCashflowRisk } from "@/monthly-analysis/agents/financial-diagnosis.js";
import { buildRuleBasedTrace } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Avalia risco de caixa com limitações explícitas
// quando faltarem dados (insufficient_data).
export async function cashflowRiskNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const cashflowRisk = assessCashflowRisk(state.normalizedEntries);

  const { costs, traces } = buildRuleBasedTrace({
    agent: "cashflow-risk",
    inputPayload: { normalizedEntries: state.normalizedEntries },
    outputPayload: cashflowRisk,
  });

  return { cashflowRisk, costs, traces };
}
