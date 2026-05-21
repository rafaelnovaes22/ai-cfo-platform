import { callLlm } from "@/llm/index.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type FinancialQaReviewAgentInput,
} from "@/monthly-analysis/agents/prompts/financial-qa-review.js";
import { QaReviewSchema, type QaReview } from "@/monthly-analysis/schemas/agents.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export type { FinancialQaReviewAgentInput } from "@/monthly-analysis/agents/prompts/financial-qa-review.js";

export interface FinancialQaReviewRunOptions extends MonthlyAgentRunOptions {
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
}

/**
 * Audita a análise mensal antes da publicação. Detecta number_mismatch, missing_doneWhen,
 * contradiction (narrativa vs. diagnóstico), missing_evidence (anomalia high sem ação) e
 * unfounded_claim. Não reescreve conteúdo — apenas emite issues estruturados e retryTargets.
 *
 * Falha rápido se o LLM devolver JSON malformado ou inválido contra QaReviewSchema.
 */
export async function runFinancialQaReviewAgent(
  state: Pick<
    MonthlyAnalysisState,
    "dre" | "anomalies" | "marginDiagnosis" | "cashflowRisk" | "narrativeCards" | "actionPlan"
  >,
  options: FinancialQaReviewRunOptions,
): Promise<QaReview> {
  if (
    !state.dre ||
    !state.anomalies ||
    !state.marginDiagnosis ||
    !state.cashflowRisk ||
    !state.narrativeCards ||
    !state.actionPlan
  ) {
    throw new Error(
      "financial-qa-review: estado incompleto — exige dre, anomalies, marginDiagnosis, cashflowRisk, narrativeCards e actionPlan.",
    );
  }

  const input: FinancialQaReviewAgentInput = {
    dre: state.dre,
    anomalies: state.anomalies,
    marginDiagnosis: state.marginDiagnosis,
    cashflowRisk: state.cashflowRisk,
    narrativeCards: state.narrativeCards,
    actionPlan: state.actionPlan,
    referenceMonth: options.referenceMonth,
    segment: options.segment,
    taxRegime: options.taxRegime,
  };

  const response = await callLlm({
    task: "financial-qa-review",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  return parseAgentJson(response.content, QaReviewSchema);
}
