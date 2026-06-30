import { describe, it, expect, vi, beforeEach } from "vitest";

const getWaitingCount = vi.fn();
const getDelayedCount = vi.fn();

vi.mock("ioredis", () => ({ default: class { } }));
vi.mock("bullmq", () => ({
  Queue: class {
    getWaitingCount = getWaitingCount;
    getDelayedCount = getDelayedCount;
    add = vi.fn();
  },
}));

import { analysisQueueAtCapacity, resolveMaxAnalysisQueueDepth } from "@/queue/index.js";

beforeEach(() => {
  getWaitingCount.mockReset();
  getDelayedCount.mockReset();
  delete process.env.MAX_ANALYSIS_QUEUE_DEPTH;
});

describe("resolveMaxAnalysisQueueDepth", () => {
  it("default 1000 sem env", () => {
    expect(resolveMaxAnalysisQueueDepth()).toBe(1000);
  });
  it("respeita env válida", () => {
    process.env.MAX_ANALYSIS_QUEUE_DEPTH = "50";
    expect(resolveMaxAnalysisQueueDepth()).toBe(50);
  });
  it("ignora env inválida (<=0)", () => {
    process.env.MAX_ANALYSIS_QUEUE_DEPTH = "-5";
    expect(resolveMaxAnalysisQueueDepth()).toBe(1000);
  });
});

describe("analysisQueueAtCapacity", () => {
  it("true quando waiting+delayed atinge o teto", async () => {
    getWaitingCount.mockResolvedValue(900);
    getDelayedCount.mockResolvedValue(100);
    expect(await analysisQueueAtCapacity(1000)).toBe(true);
  });
  it("false quando abaixo do teto", async () => {
    getWaitingCount.mockResolvedValue(10);
    getDelayedCount.mockResolvedValue(0);
    expect(await analysisQueueAtCapacity(1000)).toBe(false);
  });
});
