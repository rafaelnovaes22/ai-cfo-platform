import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateAutonomyGate, updateTenantAutonomy } from "@/learning/autonomy-gate.js";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    validationMetric: { findMany: mockFindMany },
    tenant: { findUnique: mockFindUnique, update: mockUpdate },
  }),
}));

function makeMetrics(positiveCount: number, total: number, band?: string) {
  return Array.from({ length: total }, (_, i) => ({
    signal: i < positiveCount ? "positive" : "negative",
    ...(band ? { confidenceBand: band } : {}),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

// ── evaluateAutonomyGate — classification (estratificado) ─────────────────

describe("evaluateAutonomyGate — classification", () => {
  it("retorna needs_review quando easy band tem menos de 30 amostras", async () => {
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(28, 28)) // easy: 28
      .mockResolvedValueOnce(makeMetrics(30, 30)); // hard: 30

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("needs_review");
  });

  it("retorna needs_review quando hard band tem menos de 30 amostras", async () => {
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(30, 30)) // easy: 30
      .mockResolvedValueOnce(makeMetrics(5, 5));   // hard: 5

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("needs_review");
  });

  it("retorna autonomous quando ambas as faixas têm ≥30 amostras e ≥95% positivos", async () => {
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(29, 30)) // easy: 96.7%
      .mockResolvedValueOnce(makeMetrics(29, 30)); // hard: 96.7%

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("autonomous");
  });

  it("retorna needs_review quando easy band está abaixo de 95%", async () => {
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(28, 30)) // easy: 93.3% — abaixo
      .mockResolvedValueOnce(makeMetrics(29, 30)); // hard: 96.7%

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("needs_review");
  });

  it("retorna needs_review quando hard band está abaixo de 95%", async () => {
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(29, 30)) // easy: 96.7%
      .mockResolvedValueOnce(makeMetrics(28, 30)); // hard: 93.3% — abaixo

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("needs_review");
  });

  it("retorna needs_review exatamente no limiar 94.9% (28.47/30 → 28 positivos)", async () => {
    // 28 positivos em 30 = 93.3% — abaixo do limiar 95%
    mockFindMany
      .mockResolvedValueOnce(makeMetrics(29, 30)) // easy: ok
      .mockResolvedValueOnce(makeMetrics(28, 30)); // hard: 93.3%

    const result = await evaluateAutonomyGate("t1", "classification");
    expect(result).toBe("needs_review");
  });
});

// ── evaluateAutonomyGate — narrative-synthesis / action-planning (agregado) ──

describe("evaluateAutonomyGate — narrative-synthesis (agregado)", () => {
  it("retorna needs_review com menos de 30 amostras", async () => {
    mockFindMany.mockResolvedValue(makeMetrics(20, 20));

    const result = await evaluateAutonomyGate("t1", "narrative-synthesis");
    expect(result).toBe("needs_review");
  });

  it("retorna autonomous com ≥30 amostras e ≥95% positivos", async () => {
    mockFindMany.mockResolvedValue(makeMetrics(29, 30)); // 96.7%

    const result = await evaluateAutonomyGate("t1", "narrative-synthesis");
    expect(result).toBe("autonomous");
  });

  it("retorna needs_review com ≥30 amostras mas < 95% positivos", async () => {
    mockFindMany.mockResolvedValue(makeMetrics(28, 30)); // 93.3%

    const result = await evaluateAutonomyGate("t1", "narrative-synthesis");
    expect(result).toBe("needs_review");
  });
});

describe("evaluateAutonomyGate — action-planning (agregado)", () => {
  it("usa gate agregado e retorna autonomous quando atingido", async () => {
    mockFindMany.mockResolvedValue(makeMetrics(30, 30)); // 100%

    const result = await evaluateAutonomyGate("t1", "action-planning");
    expect(result).toBe("autonomous");
  });
});

// ── updateTenantAutonomy ──────────────────────────────────────────────────

describe("updateTenantAutonomy", () => {
  it("não chama update quando nível não mudou", async () => {
    mockFindUnique.mockResolvedValue({
      learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" },
    });

    await updateTenantAutonomy("t1", "classification", "needs_review");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("atualiza apenas a chave do agente, preserva os demais", async () => {
    mockFindUnique.mockResolvedValue({
      learningAutonomyState: { classification: "needs_review", narrative: "autonomous", action: "needs_review" },
    });

    await updateTenantAutonomy("t1", "classification", "autonomous");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: {
        learningAutonomyState: {
          classification: "autonomous",
          narrative: "autonomous",
          action: "needs_review",
        },
      },
    });
  });

  it("mapeia narrative-synthesis → chave narrative", async () => {
    mockFindUnique.mockResolvedValue({
      learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" },
    });

    await updateTenantAutonomy("t1", "narrative-synthesis", "autonomous");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learningAutonomyState: expect.objectContaining({ narrative: "autonomous" }),
        }),
      }),
    );
  });

  it("mapeia action-planning → chave action", async () => {
    mockFindUnique.mockResolvedValue({
      learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" },
    });

    await updateTenantAutonomy("t1", "action-planning", "autonomous");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learningAutonomyState: expect.objectContaining({ action: "autonomous" }),
        }),
      }),
    );
  });

  it("não chama update quando tenant não existe", async () => {
    mockFindUnique.mockResolvedValue(null);

    await updateTenantAutonomy("nonexistent", "classification", "autonomous");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
