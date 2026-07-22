import type { MonthlyAnalysisState, QaGateDecision } from "@/monthly-analysis/graph/state.js";

function uniqueRetryTargets(targets: Array<"narrative-synthesis" | "action-planning">): Array<"narrative-synthesis" | "action-planning"> {
  return Array.from(new Set(targets));
}

// Decide o próximo passo após QA e registra contagem de retry. A política é:
// - publishable=true: finalize
// - blocker retryável: reexecutar narrative/action no máximo 1 vez por alvo
// - sem alvo retryável ou alvo já tentado: needsReview=true → finalize
export async function qaGateNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const review = state.qaReview;
  if (!review) {
    return {
      needsReview: true,
      qaGateDecision: "finalize",
      errors: [
        {
          agent: "financial-qa-review",
          code: "missing_qa_review",
          message: "qa_gate executado sem qaReview no estado.",
          retryable: false,
        },
      ],
    };
  }

  if (review.publishable) {
    return { needsReview: false, qaGateDecision: "finalize" };
  }

  const retryCount = {
    narrative: state.retryCount?.narrative ?? 0,
    actionPlan: state.retryCount?.actionPlan ?? 0,
  };

  for (const target of uniqueRetryTargets(review.retryTargets)) {
    if (target === "narrative-synthesis" && retryCount.narrative < 1) {
      return {
        retryCount: { ...retryCount, narrative: retryCount.narrative + 1 },
        qaGateDecision: "narrative_synthesis",
      };
    }
    if (target === "action-planning" && retryCount.actionPlan < 1) {
      return {
        retryCount: { ...retryCount, actionPlan: retryCount.actionPlan + 1 },
        qaGateDecision: "action_planning",
      };
    }
  }

  return { needsReview: true, qaGateDecision: "finalize" };
}

export function routeAfterQaGate(state: MonthlyAnalysisState): QaGateDecision {
  return state.qaGateDecision ?? "finalize";
}
