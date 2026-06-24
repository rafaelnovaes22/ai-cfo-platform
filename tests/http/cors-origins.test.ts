import { describe, expect, it } from "vitest";

import { buildCorsOrigins } from "@/http/cors-origins.js";

function includesRegex(origins: (string | RegExp)[], url: string): boolean {
  return origins.some((origin) => origin instanceof RegExp && origin.test(url));
}

describe("buildCorsOrigins", () => {
  it("preserva FRONTEND_ORIGIN configurado", () => {
    const origins = buildCorsOrigins({
      FRONTEND_ORIGIN: "https://app.aicfo.ai, https://aicfo.up.railway.app",
    });

    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("https://app.aicfo.ai");
    expect(origins).toContain("https://aicfo.up.railway.app");
  });

  it("em Railway aceita frontend staging *.up.railway.app mesmo com FRONTEND_ORIGIN definido", () => {
    const origins = buildCorsOrigins({
      RAILWAY_ENVIRONMENT: "staging",
      FRONTEND_ORIGIN: "https://aicfo.up.railway.app",
    });

    expect(includesRegex(origins, "https://aicfo-app-staging-production.up.railway.app")).toBe(true);
  });

  it("fora do Railway não libera wildcard *.up.railway.app", () => {
    const origins = buildCorsOrigins({ FRONTEND_ORIGIN: "https://aicfo.up.railway.app" });

    expect(includesRegex(origins, "https://aicfo-app-staging-production.up.railway.app")).toBe(false);
  });
});
