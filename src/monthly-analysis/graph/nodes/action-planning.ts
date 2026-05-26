import { runActionPlanningAgent } from "@/monthly-analysis/agents/action-planning.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Skip se não há narrativeCards (consequência de não haver dados normalizados).
// Caso contrário, requer dre + diagnósticos completos.
export async function actionPlanningNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  if (!state.narrativeCards || state.narrativeCards.length === 0) {
    return {};
  }
  if (!state.dre || !state.marginDiagnosis || !state.cashflowRisk) {
    throw new Error(
      "action_planning: precondição violada — dre/diagnósticos ausentes",
    );
  }
  const actionPlan = await runActionPlanningAgent(
    {
      dre: state.dre,
      anomalies: state.anomalies ?? [],
      narrativeCards: state.narrativeCards,
      marginDiagnosis: state.marginDiagnosis,
      cashflowRisk: state.cashflowRisk,
      segment: state.segment,
      taxRegime: state.taxRegime,
      toneOfVoice: state.toneOfVoice,
    },
    { tenantId: state.tenantId },
  );
  return { actionPlan };
}
