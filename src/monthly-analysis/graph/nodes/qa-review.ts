import { runFinancialQaReviewAgentWithTelemetry } from "@/monthly-analysis/agents/financial-qa-review.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Executa o revisor financeiro antes do finalize. Se o grafo não produziu
// narrativa/plano (ex.: análise sem lançamentos), não chama LLM e força revisão
// humana — SHADOW nunca deve publicar saída incompleta silenciosamente.
export async function qaReviewNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  if (!state.narrativeCards || state.narrativeCards.length === 0 || !state.actionPlan) {
    return {
      qaReview: {
        publishable: false,
        issues: [
          {
            severity: "blocker",
            code: "incomplete_agentic_output",
            message: "Grafo agentic não produziu narrativa/plano completos para revisão.",
          },
        ],
        retryTargets: [],
      },
    };
  }

  const reviewInput = {
    dre: state.dre,
    anomalies: state.anomalies ?? [],
    marginDiagnosis: state.marginDiagnosis,
    cashflowRisk: state.cashflowRisk,
    narrativeCards: state.narrativeCards,
    actionPlan: state.actionPlan,
  };
  const { data, response, latencyMs } = await runFinancialQaReviewAgentWithTelemetry(
    reviewInput,
    { tenantId: state.tenantId, traceId: state.traceId },
  );

  const { costs, traces } = buildAgentTelemetry({
    agent: "financial-qa-review",
    response,
    latencyMs,
    inputPayload: reviewInput,
    outputPayload: data,
  });

  return { qaReview: data, costs, traces };
}
