import { describe, it, expect, vi, beforeEach } from "vitest";

const updateManyMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: { updateMany: updateManyMock },
  }),
}));

vi.mock("@/observability/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { reapStuckAnalyses, resolveReaperCutoffMs } from "@/queue/reaper.js";

describe("reapStuckAnalyses", () => {
  beforeEach(() => {
    vi.useRealTimers();
    updateManyMock.mockReset();
    delete process.env.ANALYSIS_REAPER_CUTOFF_MS;
  });

  it("marca como failed apenas generating mais velhas que o teto", async () => {
    updateManyMock.mockResolvedValue({ count: 2 });
    const now = new Date("2026-06-26T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const reaped = await reapStuckAnalyses(15 * 60_000);

    expect(reaped).toBe(2);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { status: "generating", updatedAt: { lt: new Date("2026-06-26T11:45:00.000Z") } },
      data: { status: "failed" },
    });
  });

  it("retorna 0 quando nada está preso", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    const reaped = await reapStuckAnalyses(60_000);
    expect(reaped).toBe(0);
  });

  it("resolveReaperCutoffMs respeita o env e cai no default quando inválido", () => {
    process.env.ANALYSIS_REAPER_CUTOFF_MS = "600000";
    expect(resolveReaperCutoffMs()).toBe(600_000);
    process.env.ANALYSIS_REAPER_CUTOFF_MS = "lixo";
    expect(resolveReaperCutoffMs()).toBe(15 * 60_000);
  });
});
