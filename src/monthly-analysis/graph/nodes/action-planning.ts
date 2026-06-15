import { runActionPlanningAgentWithTelemetry } from "@/monthly-analysis/agents/action-planning.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import { materialityFloorCents, filterImmaterialActions } from "@/monthly-analysis/materiality.js";
import { logger } from "@/observability/logger.js";
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
    businessProfile: state.businessProfile,
    taxRegime: state.taxRegime,
    toneOfVoice: state.toneOfVoice,
  };
  const { data, response, latencyMs } = await runActionPlanningAgentWithTelemetry(input, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  // Gate de materialidade (determinístico, pós-LLM): descarta ações imateriais que
  // o modelo gera só para cumprir a cota mínima de short (ex.: "cortar R$ 46 de
  // licença"). Base = mês típico (monthlyDre), igual ao que alimentou o prompt.
  const floorCents = materialityFloorCents(state.monthlyDre ?? state.dre);
  const { plan: actionPlan, removed } = filterImmaterialActions(data, floorCents);
  if (removed.length > 0) {
    logger.info(
      {
        analysisId: state.analysisId,
        tenantId: state.tenantId,
        floorCents,
        removedCount: removed.length,
        removed: removed.map((a) => ({ horizon: a.horizon, title: a.title, impactCents: a.impactCents })),
      },
      "monthly-analysis.action-planning: ações imateriais descartadas pelo gate de materialidade",
    );
  }

  const { costs, traces } = buildAgentTelemetry({
    agent: "action-planning",
    response,
    latencyMs,
    inputPayload: input,
    outputPayload: actionPlan,
  });

  return { actionPlan, costs, traces };
}
