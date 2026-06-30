import { describe, it, expect, vi, beforeEach } from "vitest";

const getJobCounts = vi.fn();
const warn = vi.fn();
const info = vi.fn();

vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("bullmq", () => ({ Queue: class { getJobCounts = getJobCounts; add = vi.fn(); } }));
vi.mock("@/observability/logger.js", () => ({ logger: { warn: (...a: unknown[]) => warn(...a), info: (...a: unknown[]) => info(...a) } }));

import { logQueueBacklog } from "@/queue/index.js";

beforeEach(() => {
  getJobCounts.mockReset();
  warn.mockReset();
  info.mockReset();
  delete process.env.MAX_ANALYSIS_QUEUE_DEPTH;
});

describe("logQueueBacklog", () => {
  it("INFO quando backlog está abaixo do limiar de alerta (80% do teto)", async () => {
    process.env.MAX_ANALYSIS_QUEUE_DEPTH = "1000";
    getJobCounts.mockResolvedValue({ waiting: 100, active: 2, delayed: 0, failed: 1 });
    await logQueueBacklog();
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    const payload = info.mock.calls[0]![0] as { pending: number; ratioPct: number };
    expect(payload.pending).toBe(100);
    expect(payload.ratioPct).toBe(10);
  });

  it("WARN quando backlog cruza o limiar de alerta", async () => {
    process.env.MAX_ANALYSIS_QUEUE_DEPTH = "1000";
    getJobCounts.mockResolvedValue({ waiting: 850, active: 5, delayed: 0, failed: 0 });
    await logQueueBacklog();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
  });

  it("não derruba o ciclo se a coleta falhar (Redis indisponível)", async () => {
    getJobCounts.mockRejectedValue(new Error("redis down"));
    await expect(logQueueBacklog()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
