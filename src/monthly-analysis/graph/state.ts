import type { DreLines } from "@/dre-narrative/aggregator.js";
import type {
  ActionPlanDraft,
  AgentCost,
  AgentError,
  AgentTrace,
  Anomaly,
  CashflowRisk,
  ClarityResult,
  DreClassificationResult,
  MarginDiagnosis,
  NarrativeCardDraft,
  NormalizedLedgerEntry,
  QaReview,
} from "@/monthly-analysis/schemas/agents.js";

// Estado canônico do futuro grafo LangGraph do SKU monthly-analysis.
// Ele é deliberadamente aditivo: não substitui o pipeline BullMQ atual nesta branch.
export interface MonthlyAnalysisState {
  analysisId: string;
  tenantId: string;

  normalizedEntries?: NormalizedLedgerEntry[];
  clarityResults?: ClarityResult[];
  classifiedEntries?: DreClassificationResult[];

  dre?: DreLines;
  anomalies?: Anomaly[];
  marginDiagnosis?: MarginDiagnosis;
  cashflowRisk?: CashflowRisk;

  narrativeCards?: NarrativeCardDraft[];
  actionPlan?: ActionPlanDraft;
  qaReview?: QaReview;

  costs: AgentCost[];
  traces: AgentTrace[];
  errors: AgentError[];
}

export function createInitialMonthlyAnalysisState(input: {
  analysisId: string;
  tenantId: string;
}): MonthlyAnalysisState {
  return {
    analysisId: input.analysisId,
    tenantId: input.tenantId,
    costs: [],
    traces: [],
    errors: [],
  };
}
