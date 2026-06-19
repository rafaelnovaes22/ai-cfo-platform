import { describe, it, expect, vi, beforeEach } from "vitest";

// Garantia de custo: a análise (com LLM) só roda para assinante ativo. Qualquer
// não-assinante (student/trial/sem assinatura/inadimplente) importa em modo
// cashflow-only (skipAnalysis=true) — zero IA, custo R$0.

const subscriptionFindUniqueMock = vi.fn();
vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    subscription: { findUnique: (...args: unknown[]) => subscriptionFindUniqueMock(...args) },
  }),
}));

const { resolveSkipAnalysis } = await import("@/ingest/routes.js");

describe("resolveSkipAnalysis (gate de IA por plano)", () => {
  beforeEach(() => subscriptionFindUniqueMock.mockReset());

  it("student ativo → cashflow-only (skip)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ plan: "student", status: "active" });
    expect(await resolveSkipAnalysis("t1")).toBe(true);
  });

  it("trial ativo → cashflow-only (skip)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ plan: "trial", status: "active" });
    expect(await resolveSkipAnalysis("t1")).toBe(true);
  });

  it("sem assinatura → cashflow-only (skip)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue(null);
    expect(await resolveSkipAnalysis("t1")).toBe(true);
  });

  it("assinante ativo (lite/pro/business) → roda análise (não skip)", async () => {
    for (const plan of ["lite", "pro", "business"]) {
      subscriptionFindUniqueMock.mockResolvedValue({ plan, status: "active" });
      expect(await resolveSkipAnalysis("t1")).toBe(false);
    }
  });

  it("assinante inadimplente (past_due) → cashflow-only (skip)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ plan: "pro", status: "past_due" });
    expect(await resolveSkipAnalysis("t1")).toBe(true);
  });
});
