import { detectFinancialAnomalies } from "@/monthly-analysis/agents/financial-diagnosis.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Detecta outliers, prejuízo, margens críticas,
// classificação incompleta, etc. Pode rodar em paralelo com margin/cashflow.
export async function anomalyDetectionNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const anomalies = detectFinancialAnomalies({
    dre: state.dre,
    normalizedEntries: state.normalizedEntries,
    segment: state.segment,
  });
  return { anomalies };
}
