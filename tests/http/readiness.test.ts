import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn();
const queueDepthMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({ $queryRaw: (...args: unknown[]) => queryRawMock(...args) }),
}));

vi.mock("@/queue/index.js", () => ({
  getMonthlyAnalysisQueueDepth: () => queueDepthMock(),
}));

import { checkReadiness } from "@/http/readiness.js";

beforeEach(() => {
  queryRawMock.mockReset();
  queueDepthMock.mockReset();
});

describe("checkReadiness", () => {
  it("ready=true quando DB e Redis respondem; inclui backlog da fila", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    queueDepthMock.mockResolvedValueOnce({ waiting: 3, active: 1, delayed: 0, failed: 0 });

    const r = await checkReadiness();

    expect(r.ready).toBe(true);
    expect(r.checks).toEqual({ db: true, redis: true });
    expect(r.queue).toEqual({ waiting: 3, active: 1, delayed: 0, failed: 0 });
  });

  it("ready=false quando DB falha", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("db down"));
    queueDepthMock.mockResolvedValueOnce({ waiting: 0, active: 0, delayed: 0, failed: 0 });

    const r = await checkReadiness();

    expect(r.ready).toBe(false);
    expect(r.checks.db).toBe(false);
    expect(r.checks.redis).toBe(true);
  });

  it("ready=false quando Redis/fila falha", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    queueDepthMock.mockRejectedValueOnce(new Error("redis down"));

    const r = await checkReadiness();

    expect(r.ready).toBe(false);
    expect(r.checks.redis).toBe(false);
    expect(r.queue).toBeNull();
  });
});
