import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma — capturamos a chamada de monthlyAnalysis.update dentro de $transaction
const findUniqueAnalysisMock = vi.fn();
const txAnalysisUpdateMock = vi.fn();
const txTransactionMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueAnalysisMock(...args),
    },
    $transaction: (...args: unknown[]) => txTransactionMock(...args),
  }),
}));

import { finalizeNode } from "@/monthly-analysis/graph/nodes/finalize.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

function baseState(overrides: Partial<MonthlyAnalysisState> = {}): MonthlyAnalysisState {
  return {
    analysisId: "analysis-1",
    tenantId: "tenant-1",
    costs: [],
    traces: [],
    errors: [],
    dre: undefined,
    anomalies: [],
    narrativeCards: [],
    actionPlan: { actions: [] },
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueAnalysisMock.mockReset();
  txAnalysisUpdateMock.mockReset();
  txTransactionMock.mockReset();
  txTransactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      monthlyAnalysis: { update: txAnalysisUpdateMock },
      narrativeCard: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      actionPlanItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
  });
});

describe("finalizeNode — falha hard quando persistência quebra (achado D)", () => {
  it("re-lança erro do $transaction em vez de retornar {}", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce({ mode: "shadow", costCents: 0 });
    const persistError = new Error("simulated tx failure");
    txTransactionMock.mockRejectedValueOnce(persistError);

    await expect(finalizeNode(baseState())).rejects.toBe(persistError);
  });

  it("re-lança erro quando analysis sumiu entre o invoke e o finalize", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce(null);

    await expect(finalizeNode(baseState())).rejects.toThrow(/não encontrada/);
    expect(txTransactionMock).not.toHaveBeenCalled();
  });
});

describe("finalizeNode — respeita needsReview em autonomous (achado F)", () => {
  it("modo autonomous + needsReview=true → status='ready', sem deliveredAt", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce({ mode: "autonomous", costCents: 0 });

    await finalizeNode(baseState({ needsReview: true }));

    expect(txAnalysisUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = txAnalysisUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArg.data.status).toBe("ready");
    expect(updateArg.data.deliveredAt).toBeUndefined();
  });

  it("modo autonomous + needsReview=false → status='delivered' com deliveredAt", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce({ mode: "autonomous", costCents: 0 });

    await finalizeNode(baseState({ needsReview: false }));

    const updateArg = txAnalysisUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArg.data.status).toBe("delivered");
    expect(updateArg.data.deliveredAt).toBeInstanceOf(Date);
  });

  it("modo shadow ignora needsReview e sempre grava status='ready'", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce({ mode: "shadow", costCents: 0 });

    await finalizeNode(baseState({ needsReview: false }));

    const updateArg = txAnalysisUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArg.data.status).toBe("ready");
    expect(updateArg.data.deliveredAt).toBeUndefined();
  });
});

describe("finalizeNode — soma totalCostCents do estado", () => {
  it("acumula costs[*].costCents sobre o costCents prévio", async () => {
    findUniqueAnalysisMock.mockResolvedValueOnce({ mode: "shadow", costCents: 100 });

    await finalizeNode(
      baseState({
        costs: [
          { agent: "normalization", provider: "openai", model: "gpt-4.1-nano", inputTokens: 0, outputTokens: 0, costCents: 5, latencyMs: 10, traceId: null },
          { agent: "narrative-synthesis", provider: "google", model: "gemini", inputTokens: 0, outputTokens: 0, costCents: 7, latencyMs: 20, traceId: null },
        ],
      }),
    );

    const updateArg = txAnalysisUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArg.data.costCents).toBe(100 + 12);
  });
});
