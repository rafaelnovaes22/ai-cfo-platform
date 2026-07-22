import { detectFinancialAnomalies } from "@/monthly-analysis/agents/financial-diagnosis.js";
import { buildRuleBasedTrace } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Detecta outliers, prejuízo, margens críticas,
// classificação incompleta, etc. Pode rodar em paralelo com margin/cashflow.
// Emite AgentTrace mínimo (sem AgentCost) para auditabilidade.
export async function anomalyDetectionNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const input = {
    dre: state.dre,
    normalizedEntries: state.normalizedEntries,
    segment: state.segment,
  };
  const anomalies = detectFinancialAnomalies(input);

  const { costs, traces } = buildRuleBasedTrace({
    agent: "anomaly-detection",
    inputPayload: input,
    outputPayload: anomalies,
  });

  return { anomalies, costs, traces };
}
