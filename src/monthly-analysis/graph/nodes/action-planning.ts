import { runActionPlanningAgentWithTelemetry } from "@/monthly-analysis/agents/action-planning.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
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
  // DRE em run-rate mensal por categoria (mês típico): o plano recomenda valores
  // mensais (ex.: "reduza o pró-labore mensal para X"), então não pode usar o total
  // de N meses do extrato como se fosse mensal. Fallback ao total se ausente.
  const input = {
    dre: state.monthlyDre ?? state.dre,
    anomalies: state.anomalies ?? [],
    narrativeCards: state.narrativeCards,
    marginDiagnosis: state.marginDiagnosis,
    cashflowRisk: state.cashflowRisk,
    segment: state.segment,
    taxRegime: state.taxRegime,
    toneOfVoice: state.toneOfVoice,
  };
  const { data, response, latencyMs } = await runActionPlanningAgentWithTelemetry(input, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  const { costs, traces } = buildAgentTelemetry({
    agent: "action-planning",
    response,
    latencyMs,
    inputPayload: input,
    outputPayload: data,
  });

  return { actionPlan: data, costs, traces };
}
