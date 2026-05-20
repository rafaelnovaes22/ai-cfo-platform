import { diagnoseMargins } from "@/monthly-analysis/agents/financial-diagnosis.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Classifica margens bruta/operacional + drivers.
export async function marginDiagnosisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  return { marginDiagnosis: diagnoseMargins(state.dre) };
}
