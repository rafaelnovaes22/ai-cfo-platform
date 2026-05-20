import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  }),
}));

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";

describe("monthly-analysis graph skeleton", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("compila e invoca START → load_analysis → finalize → END com estado vazio", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "test-id",
      tenantId: "test-tenant",
      status: "pending",
    });

    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: "test-id",
      tenantId: "test-tenant",
      costs: [],
      traces: [],
      errors: [],
    });

    expect(result.analysisId).toBe("test-id");
    expect(result.tenantId).toBe("test-tenant");
    expect(Array.isArray(result.costs)).toBe(true);
    expect(Array.isArray(result.traces)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.costs).toHaveLength(0);
    expect(result.traces).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "test-id" },
      select: { id: true, tenantId: true, status: true },
    });
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
    expect(Array.isArray(result.costs)).toBe(true);
    expect(Array.isArray(result.traces)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("detecta tenant mismatch sem lançar erro (apenas loga e segue)", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "test-id",
      tenantId: "outro-tenant",
      status: "pending",
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
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
