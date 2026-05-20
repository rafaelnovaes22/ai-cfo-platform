import { describe, it, expect, vi, beforeEach } from "vitest";

const loadAnalysisNodeMock = vi.fn();
const normalizeNodeMock = vi.fn();
const clarityJudgeNodeMock = vi.fn();
const dreClassifierNodeMock = vi.fn();
const aggregateDreNodeMock = vi.fn();
const anomalyDetectionNodeMock = vi.fn();
const marginDiagnosisNodeMock = vi.fn();
const cashflowRiskNodeMock = vi.fn();
const narrativeSynthesisNodeMock = vi.fn();
const actionPlanningNodeMock = vi.fn();
const qaReviewNodeMock = vi.fn();
const finalizeNodeMock = vi.fn();

vi.mock("@/monthly-analysis/graph/nodes/load-analysis.js", () => ({
  loadAnalysisNode: (...args: unknown[]) => loadAnalysisNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/normalize.js", () => ({
  normalizeNode: (...args: unknown[]) => normalizeNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/clarity-judge.js", () => ({
  clarityJudgeNode: (...args: unknown[]) => clarityJudgeNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/dre-classifier.js", () => ({
  dreClassifierNode: (...args: unknown[]) => dreClassifierNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/aggregate-dre.js", () => ({
  aggregateDreNode: (...args: unknown[]) => aggregateDreNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/anomaly-detection.js", () => ({
  anomalyDetectionNode: (...args: unknown[]) => anomalyDetectionNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/margin-diagnosis.js", () => ({
  marginDiagnosisNode: (...args: unknown[]) => marginDiagnosisNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/cashflow-risk.js", () => ({
  cashflowRiskNode: (...args: unknown[]) => cashflowRiskNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/narrative-synthesis.js", () => ({
  narrativeSynthesisNode: (...args: unknown[]) => narrativeSynthesisNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/action-planning.js", () => ({
  actionPlanningNode: (...args: unknown[]) => actionPlanningNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/qa-review.js", () => ({
  qaReviewNode: (...args: unknown[]) => qaReviewNodeMock(...args),
}));
vi.mock("@/monthly-analysis/graph/nodes/finalize.js", () => ({
  finalizeNode: (...args: unknown[]) => finalizeNodeMock(...args),
}));

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";
import type { QaReview } from "@/monthly-analysis/schemas/agents.js";

const TENANT = "tenant-test";
const ANALYSIS = "analysis-test";

function review(overrides: Partial<QaReview>): QaReview {
  return {
    publishable: true,
    issues: [],
    retryTargets: [],
    ...overrides,
  };
}

function setupGraphMocks(reviews: QaReview[]): void {
  let narrativeRun = 0;
  let actionRun = 0;
  const qaQueue = [...reviews];

  loadAnalysisNodeMock.mockResolvedValue({ rawEntries: [{ entryId: "e1" }] });
  normalizeNodeMock.mockResolvedValue({ normalizedEntries: [{ entryId: "e1" }] });
  clarityJudgeNodeMock.mockResolvedValue({ clarityResults: [{ entryId: "e1", clarity: "clear", reason: "ok" }] });
  dreClassifierNodeMock.mockResolvedValue({ classifiedEntries: [{ entryId: "e1", category: "receita_bruta", confidence: 0.95 }] });
  aggregateDreNodeMock.mockResolvedValue({ dre: { receitaLiquida: 100000 } });
  anomalyDetectionNodeMock.mockResolvedValue({ anomalies: [] });
  marginDiagnosisNodeMock.mockResolvedValue({
    marginDiagnosis: {
      grossMarginStatus: "healthy",
      operatingMarginStatus: "healthy",
      mainDrivers: [{ driver: "receita", evidenceMetric: "receitaLiquida", impactCents: 100000, severity: "low" }],
    },
  });
  cashflowRiskNodeMock.mockResolvedValue({ cashflowRisk: { status: "healthy", reasons: ["base suficiente"], limitations: [] } });
  narrativeSynthesisNodeMock.mockImplementation(async () => {
    narrativeRun += 1;
    return {
      narrativeCards: [
        { type: "critical_gap", title: `gap ${narrativeRun}`, body: "card com evidência", evidenceRefs: ["receitaLiquida"] },
        { type: "attention", title: `attention ${narrativeRun}`, body: "card com evidência", evidenceRefs: ["receitaLiquida"] },
        { type: "healthy", title: `healthy ${narrativeRun}`, body: "card com evidência", evidenceRefs: ["receitaLiquida"] },
      ],
    };
  });
  actionPlanningNodeMock.mockImplementation(async () => {
    actionRun += 1;
    return {
      actionPlan: {
        actions: [
          { horizon: "short", title: `ação curta ${actionRun}.1`, description: "desc", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito", evidenceRefs: ["receitaLiquida"], assumptions: [], confidence: 0.8 },
          { horizon: "short", title: `ação curta ${actionRun}.2`, description: "desc", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito", evidenceRefs: ["receitaLiquida"], assumptions: [], confidence: 0.8 },
          { horizon: "short", title: `ação curta ${actionRun}.3`, description: "desc", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito", evidenceRefs: ["receitaLiquida"], assumptions: [], confidence: 0.8 },
          { horizon: "medium", title: `ação média ${actionRun}`, description: "desc", effortLevel: "medium", riskLevel: "low", impactCents: 1, doneWhen: "feito", evidenceRefs: ["receitaLiquida"], assumptions: [], confidence: 0.8 },
          { horizon: "long", title: `ação longa ${actionRun}`, description: "desc", effortLevel: "high", riskLevel: "medium", impactCents: 1, doneWhen: "feito", evidenceRefs: ["receitaLiquida"], assumptions: [], confidence: 0.8 },
        ],
      },
    };
  });
  qaReviewNodeMock.mockImplementation(async () => ({ qaReview: qaQueue.shift() ?? reviews.at(-1) }));
  finalizeNodeMock.mockResolvedValue({});
}

async function invokeGraph() {
  const graph = buildMonthlyAnalysisGraph();
  return graph.invoke({
    analysisId: ANALYSIS,
    tenantId: TENANT,
    costs: [],
    traces: [],
    errors: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("monthly-analysis graph QA retry gate (5.A.2)", () => {
  it("finaliza direto quando QA aprova a saída", async () => {
    setupGraphMocks([review({ publishable: true })]);

    const result = await invokeGraph();

    expect(qaReviewNodeMock).toHaveBeenCalledTimes(1);
    expect(narrativeSynthesisNodeMock).toHaveBeenCalledTimes(1);
    expect(actionPlanningNodeMock).toHaveBeenCalledTimes(1);
    expect(finalizeNodeMock).toHaveBeenCalledTimes(1);
    expect(result.needsReview).toBe(false);
    expect(result.qaGateDecision).toBe("finalize");
  });

  it("reexecuta narrativa uma vez quando QA aponta retryTarget narrative-synthesis e depois aprova", async () => {
    setupGraphMocks([
      review({
        publishable: false,
        issues: [{ severity: "blocker", code: "unfounded_claim", message: "narrativa sem evidência" }],
        retryTargets: ["narrative-synthesis"],
      }),
      review({ publishable: true }),
    ]);

    const result = await invokeGraph();

    expect(qaReviewNodeMock).toHaveBeenCalledTimes(2);
    expect(narrativeSynthesisNodeMock).toHaveBeenCalledTimes(2);
    expect(actionPlanningNodeMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toEqual({ narrative: 1, actionPlan: 0 });
    expect(result.needsReview).toBe(false);
  });

  it("marca needsReview quando o retry já foi usado e QA continua bloqueando", async () => {
    const blocker = review({
      publishable: false,
      issues: [{ severity: "blocker", code: "number_mismatch", message: "número diverge do DRE" }],
      retryTargets: ["narrative-synthesis"],
    });
    setupGraphMocks([blocker, blocker]);

    const result = await invokeGraph();

    expect(qaReviewNodeMock).toHaveBeenCalledTimes(2);
    expect(narrativeSynthesisNodeMock).toHaveBeenCalledTimes(2);
    expect(actionPlanningNodeMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toEqual({ narrative: 1, actionPlan: 0 });
    expect(result.needsReview).toBe(true);
    expect(result.qaGateDecision).toBe("finalize");
  });
});
