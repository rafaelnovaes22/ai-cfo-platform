import { diagnoseMargins } from "@/monthly-analysis/agents/financial-diagnosis.js";
import { buildRuleBasedTrace } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Rule-based — sem LLM. Classifica margens bruta/operacional + drivers.
export async function marginDiagnosisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const marginDiagnosis = diagnoseMargins(state.dre, state.segment);

  const { costs, traces } = buildRuleBasedTrace({
    agent: "margin-diagnosis",
    inputPayload: { dre: state.dre, segment: state.segment },
    outputPayload: marginDiagnosis,
  });

  return { marginDiagnosis, costs, traces };
}
