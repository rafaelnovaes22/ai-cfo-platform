import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const findManyAnalysesMock = vi.fn();
const findManyLedgerMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyAnalysesMock(...args),
    },
    ledgerEntry: {
      findMany: (...args: unknown[]) => findManyLedgerMock(...args),
    },
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
    callLlmMock.mockReset();
    // padrão: sem histórico
    findManyAnalysesMock.mockResolvedValue([]);
  });

  it("compila e fecha o grafo sem dados — todos os nós degradam graciosamente", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "test-id",
      tenantId: "test-tenant",
      status: "pending",
      referenceMonth: "2026-05",
      openingBalanceCents: null,
      tenant: { industrySegment: "servicos-b2b", taxRegime: "simples", productConfig: {} },
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

  it("tolera analysis ausente no Prisma e ainda fecha o grafo", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: "missing-id",
      tenantId: "test-tenant",
      costs: [],
      traces: [],
      errors: [],
    });

    expect(result.analysisId).toBe("missing-id");
    expect(result.rawEntries).toBeUndefined();
    expect(callLlmMock).not.toHaveBeenCalled();
  });

  it("detecta tenant mismatch sem lançar erro (apenas loga e segue)", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "test-id",
      tenantId: "outro-tenant",
      status: "pending",
      referenceMonth: "2026-05",
      openingBalanceCents: null,
    });

    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: "test-id",
      tenantId: "test-tenant",
      costs: [],
      traces: [],
      errors: [],
    });

    expect(result.tenantId).toBe("test-tenant");
    expect(result.rawEntries).toBeUndefined();
    expect(callLlmMock).not.toHaveBeenCalled();
  });
});
