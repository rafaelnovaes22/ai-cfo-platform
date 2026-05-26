import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { loadAnalysisNode } from "@/monthly-analysis/graph/nodes/load-analysis.js";
import { normalizeNode } from "@/monthly-analysis/graph/nodes/normalize.js";
import { clarityJudgeNode } from "@/monthly-analysis/graph/nodes/clarity-judge.js";
import { dreClassifierNode } from "@/monthly-analysis/graph/nodes/dre-classifier.js";
import { aggregateDreNode } from "@/monthly-analysis/graph/nodes/aggregate-dre.js";
import { anomalyDetectionNode } from "@/monthly-analysis/graph/nodes/anomaly-detection.js";
import { marginDiagnosisNode } from "@/monthly-analysis/graph/nodes/margin-diagnosis.js";
import { cashflowRiskNode } from "@/monthly-analysis/graph/nodes/cashflow-risk.js";
import { narrativeSynthesisNode } from "@/monthly-analysis/graph/nodes/narrative-synthesis.js";
import { actionPlanningNode } from "@/monthly-analysis/graph/nodes/action-planning.js";
import { qaReviewNode } from "@/monthly-analysis/graph/nodes/qa-review.js";
import { qaGateNode, routeAfterQaGate } from "@/monthly-analysis/graph/nodes/qa-gate.js";
import { finalizeNode } from "@/monthly-analysis/graph/nodes/finalize.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";
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

// Annotation root espelhando MonthlyAnalysisState. Arrays usam reducer de
// concatenação — necessário para o fan-out paralelo (anomaly/margin/cashflow)
// emitir traces/costs sem sobrescrever uns aos outros.
export const MonthlyAnalysisAnnotation = Annotation.Root({
  analysisId: Annotation<string>(),
  tenantId: Annotation<string>(),
  segment: Annotation<string | undefined>(),
  taxRegime: Annotation<string | undefined>(),
  toneOfVoice: Annotation<string | undefined>(),

  rawEntries: Annotation<RawLedgerEntry[] | undefined>(),

  normalizedEntries: Annotation<NormalizedLedgerEntry[] | undefined>(),
  clarityResults: Annotation<ClarityResult[] | undefined>(),
  classifiedEntries: Annotation<DreClassificationResult[] | undefined>(),

  dre: Annotation<DreLines | undefined>(),
  anomalies: Annotation<Anomaly[] | undefined>(),
  marginDiagnosis: Annotation<MarginDiagnosis | undefined>(),
  cashflowRisk: Annotation<CashflowRisk | undefined>(),

  narrativeCards: Annotation<NarrativeCardDraft[] | undefined>(),
  actionPlan: Annotation<ActionPlanDraft | undefined>(),
  qaReview: Annotation<QaReview | undefined>(),
  needsReview: Annotation<boolean | undefined>(),
  retryCount: Annotation<{ narrative: number; actionPlan: number } | undefined>(),
  qaGateDecision: Annotation<"narrative_synthesis" | "action_planning" | "finalize" | undefined>(),

  costs: Annotation<AgentCost[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  traces: Annotation<AgentTrace[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  errors: Annotation<AgentError[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
});

// Factory: monta e compila o grafo do SKU monthly-analysis.
//
// Topologia:
//   load_analysis → normalize → clarity_judge → dre_classifier → aggregate_dre
//     → [anomaly_detection ‖ margin_diagnosis ‖ cashflow_risk] (paralelo)
//     → narrative_synthesis → action_planning → qa_review → qa_gate
//     → finalize | retry narrative/action once → qa_review → finalize/needsReview
//
// Wave 3.C.2 adicionará: instrumentação Langfuse explícita por nó.
export function buildMonthlyAnalysisGraph() {
  const graph = new StateGraph(MonthlyAnalysisAnnotation)
    .addNode("load_analysis", loadAnalysisNode)
    .addNode("normalize", normalizeNode)
    .addNode("clarity_judge", clarityJudgeNode)
    .addNode("dre_classifier", dreClassifierNode)
    .addNode("aggregate_dre", aggregateDreNode)
    .addNode("anomaly_detection", anomalyDetectionNode)
    .addNode("margin_diagnosis", marginDiagnosisNode)
    .addNode("cashflow_risk", cashflowRiskNode)
    .addNode("narrative_synthesis", narrativeSynthesisNode)
    .addNode("action_planning", actionPlanningNode)
    .addNode("qa_review", qaReviewNode)
    .addNode("qa_gate", qaGateNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "load_analysis")
    .addEdge("load_analysis", "normalize")
    .addEdge("normalize", "clarity_judge")
    .addEdge("clarity_judge", "dre_classifier")
    .addEdge("dre_classifier", "aggregate_dre")
    // Fan-out: aggregate_dre dispara os 3 diagnósticos em paralelo.
    .addEdge("aggregate_dre", "anomaly_detection")
    .addEdge("aggregate_dre", "margin_diagnosis")
    .addEdge("aggregate_dre", "cashflow_risk")
    // Fan-in: narrative_synthesis espera os 3 (barrier implícito do LangGraph).
    .addEdge("anomaly_detection", "narrative_synthesis")
    .addEdge("margin_diagnosis", "narrative_synthesis")
    .addEdge("cashflow_risk", "narrative_synthesis")
    .addEdge("narrative_synthesis", "action_planning")
    .addEdge("action_planning", "qa_review")
    .addEdge("qa_review", "qa_gate")
    .addConditionalEdges("qa_gate", routeAfterQaGate, {
      narrative_synthesis: "narrative_synthesis",
      action_planning: "action_planning",
      finalize: "finalize",
    })
    .addEdge("finalize", END);

  return graph.compile();
}
