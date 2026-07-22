import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEvalContinuous } from "@/learning/eval-continuous.js";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    tenant: { findMany: mockFindMany },
  }),
}));

const mockEvaluate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/learning/autonomy-gate.js", () => ({
  evaluateAutonomyGate: (...args: unknown[]) => mockEvaluate(...args),
  updateTenantAutonomy: (...args: unknown[]) => mockUpdate(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
});

describe("runEvalContinuous", () => {
  it("retorna relatório vazio quando não há tenants", async () => {
    mockFindMany.mockResolvedValue([]);

    const report = await runEvalContinuous();

    expect(report.tenantsChecked).toBe(0);
    expect(report.agentsEvaluated).toBe(0);
    expect(report.changes).toHaveLength(0);
  });

  it("avalia 3 agentes por tenant", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" } },
    ]);
    mockEvaluate.mockResolvedValue("needs_review");

    const report = await runEvalContinuous();

    expect(report.agentsEvaluated).toBe(3);
    expect(mockEvaluate).toHaveBeenCalledTimes(3);
  });

  it("não chama updateTenantAutonomy quando nível não mudou", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" } },
    ]);
    mockEvaluate.mockResolvedValue("needs_review");

    await runEvalContinuous();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("registra promoção quando gate muda de needs_review para autonomous", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" } },
    ]);
    mockEvaluate
      .mockResolvedValueOnce("autonomous")  // classification
      .mockResolvedValueOnce("needs_review") // narrative
      .mockResolvedValueOnce("needs_review"); // action

    const report = await runEvalContinuous();

    expect(report.promotions).toBe(1);
    expect(report.demotions).toBe(0);
    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]).toMatchObject({
      tenantId: "t1",
      agentName: "classification",
      previous: "needs_review",
      current: "autonomous",
    });
  });

  it("registra rebaixamento quando gate cai de autonomous para needs_review", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: { classification: "autonomous", narrative: "needs_review", action: "needs_review" } },
    ]);
    mockEvaluate
      .mockResolvedValueOnce("needs_review") // classification: rebaixamento
      .mockResolvedValueOnce("needs_review")
      .mockResolvedValueOnce("needs_review");

    const report = await runEvalContinuous();

    expect(report.demotions).toBe(1);
    expect(report.promotions).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith("t1", "classification", "needs_review");
  });

  it("processa múltiplos tenants e acumula mudanças", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" } },
      { id: "t2", learningAutonomyState: { classification: "needs_review", narrative: "needs_review", action: "needs_review" } },
    ]);
    // t1: classification promovido; t2: sem mudança
    mockEvaluate
      .mockResolvedValueOnce("autonomous")   // t1 classification
      .mockResolvedValueOnce("needs_review") // t1 narrative
      .mockResolvedValueOnce("needs_review") // t1 action
      .mockResolvedValueOnce("needs_review") // t2 classification
      .mockResolvedValueOnce("needs_review") // t2 narrative
      .mockResolvedValueOnce("needs_review"); // t2 action

    const report = await runEvalContinuous();

    expect(report.tenantsChecked).toBe(2);
    expect(report.agentsEvaluated).toBe(6);
    expect(report.promotions).toBe(1);
    expect(report.changes).toHaveLength(1);
  });

  it("usa needs_review como default quando learningAutonomyState está ausente", async () => {
    mockFindMany.mockResolvedValue([
      { id: "t1", learningAutonomyState: null },
    ]);
    mockEvaluate.mockResolvedValue("needs_review");

    const report = await runEvalContinuous();

    expect(report.agentsEvaluated).toBe(3);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
