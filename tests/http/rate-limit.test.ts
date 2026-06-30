import { describe, it, expect, vi, beforeEach } from "vitest";

// Evita conexão Redis real ao construir as opções em modo Railway.
vi.mock("ioredis", () => ({ default: class { constructor() {} } }));

import { shouldUseRedisStore, buildRateLimitOptions } from "@/http/rate-limit.js";

beforeEach(() => {
  delete process.env.RATE_LIMIT_MAX;
});

describe("shouldUseRedisStore", () => {
  it("false em dev (sem RAILWAY_ENVIRONMENT)", () => {
    expect(shouldUseRedisStore({ REDIS_URL: "redis://localhost:6379" })).toBe(false);
  });
  it("false em Railway sem REDIS_URL", () => {
    expect(shouldUseRedisStore({ RAILWAY_ENVIRONMENT: "production" })).toBe(false);
  });
  it("true em Railway com REDIS_URL", () => {
    expect(shouldUseRedisStore({ RAILWAY_ENVIRONMENT: "production", REDIS_URL: "redis://host:6379" })).toBe(true);
  });
});

describe("buildRateLimitOptions", () => {
  it("dev: sem store redis, max default 100, fail-open", () => {
    const opts = buildRateLimitOptions({ NODE_ENV: "development" });
    expect(opts.max).toBe(100);
    expect(opts.timeWindow).toBe("1 minute");
    expect(opts.skipOnError).toBe(true);
    expect("redis" in opts).toBe(false);
  });

  it("respeita RATE_LIMIT_MAX", () => {
    const opts = buildRateLimitOptions({ RATE_LIMIT_MAX: "250" });
    expect(opts.max).toBe(250);
  });

  it("Railway: inclui store redis compartilhado", () => {
    const opts = buildRateLimitOptions({ RAILWAY_ENVIRONMENT: "production", REDIS_URL: "redis://host:6379" });
    expect("redis" in opts).toBe(true);
    expect(opts.redis).toBeDefined();
  });
});
