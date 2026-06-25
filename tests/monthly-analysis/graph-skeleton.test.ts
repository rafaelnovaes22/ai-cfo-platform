import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const findManyAnalysesMock = vi.fn();
const findManyLedgerMock = vi.fn();
const findManyMemoryMock = vi.fn();
const findManyGlobalMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyAnalysesMock(...args),
      update: vi.fn().mockResolvedValue({}),
    },
    ledgerEntry: {
      findMany: (...args: unknown[]) => findManyLedgerMock(...args),
    },
    tenantMemoryItem: {
      findMany: (...args: unknown[]) => findManyMemoryMock(...args),
    },
    globalSignal: {
      findMany: (...args: unknown[]) => findManyGlobalMock(...args),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        monthlyAnalysis: { update: vi.fn().mockResolvedValue({}) },
        narrativeCard: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        actionPlanItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      });
    }),
  }),
}));

// Pipeline completo invocará callLlm para alguns nós. Em estado vazio,
// os nós com short-circuit (normalize/clarity/dre-classifier/narrative/action)
// não chamam o LLM — mock genérico só por segurança.
const callLlmMock = vi.fn();
vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";

describe("monthly-analysis graph skeleton (data-empty paths)", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findManyAnalysesMock.mockReset();
    findManyLedgerMock.mockReset();
    findManyMemoryMock.mockReset();
    findManyGlobalMock.mockReset();
    callLlmMock.mockReset();
    // padrão: sem histórico nem memória de tenant
    findManyAnalysesMock.mockResolvedValue([]);
    findManyMemoryMock.mockResolvedValue([]);
    findManyGlobalMock.mockResolvedValue([]);
  });

  it("compila e fecha o grafo sem dados — todos os nós degradam graciosamente", async () => {
    // load_analysis e finalize ambos chamam findUnique — devolve dois shapes diferentes
    // (load pede tenant nested; finalize pede mode/costCents). mockResolvedValue cobre ambos.
    findUniqueMock.mockResolvedValue({
      id: "test-id",
      tenantId: "test-tenant",
      status: "pending",
      referenceMonth: "2026-05",
      openingBalanceCents: null,
      tenant: { industrySegment: "servicos-b2b", taxRegime: "simples", productConfig: {} },
      mode: "shadow",
      costCents: 0,
    });
    findManyLedgerMock.mockResolvedValueOnce([]);

    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: "test-id",
      tenantId: "test-tenant",
      costs: [],
      traces: [],
      errors: [],
    });

    expect(result.analysisId).toBe("test-id");
    expect(result.rawEntries).toEqual([]);
    expect(result.normalizedEntries).toEqual([]);
    expect(result.clarityResults).toEqual([]);
    expect(result.classifiedEntries).toEqual([]);
    expect(result.narrativeCards).toEqual([]);
    expect(result.actionPlan).toBeUndefined();
    expect(result.historicalDre).toEqual([]);
    expect(result.previousDre).toBeUndefined();
    expect(result.openingBalance).toBeUndefined();
    expect(Array.isArray(result.costs)).toBe(true);
    expect(Array.isArray(result.traces)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(callLlmMock).not.toHaveBeenCalled();
  });

  it("falha hard quando analysis ausente no Prisma — BullMQ deve reverter status", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const graph = buildMonthlyAnalysisGraph();

    await expect(
      graph.invoke({
        analysisId: "missing-id",
        tenantId: "test-tenant",
        costs: [],
        traces: [],
        errors: [],
      }),
    ).rejects.toThrow(/analysisId "missing-id" não encontrada/);
    expect(callLlmMock).not.toHaveBeenCalled();
  });

  it("detecta tenant mismatch e lança erro hard (violação C5/L1)", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "test-id",
      tenantId: "outro-tenant",
      status: "pending",
      referenceMonth: "2026-05",
      openingBalanceCents: null,
    });

    const graph = buildMonthlyAnalysisGraph();

    await expect(
      graph.invoke({
        analysisId: "test-id",
        tenantId: "test-tenant",
        costs: [],
        traces: [],
        errors: [],
      }),
    ).rejects.toThrow(/violação C5\/L1/);
    expect(callLlmMock).not.toHaveBeenCalled();
  });
});
