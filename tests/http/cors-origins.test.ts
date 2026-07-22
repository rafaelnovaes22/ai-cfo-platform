import { describe, expect, it } from "vitest";

import { buildCorsOrigins } from "@/http/cors-origins.js";

const PLATFORM_PATTERN = "^https://myapp[a-z0-9-]*\\.platform\\.example\\.com$";

function includesRegex(origins: (string | RegExp)[], url: string): boolean {
  return origins.some((origin) => origin instanceof RegExp && origin.test(url));
}

describe("buildCorsOrigins", () => {
  it("preserva FRONTEND_ORIGIN configurado", () => {
    const origins = buildCorsOrigins({
      FRONTEND_ORIGIN: "https://app.example.com, https://myapp.platform.example.com",
    });

    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("https://app.example.com");
    expect(origins).toContain("https://myapp.platform.example.com");
  });

  it("na plataforma aceita frontend staging via CORS_ORIGIN_PATTERN mesmo com FRONTEND_ORIGIN definido", () => {
    const origins = buildCorsOrigins({
      RAILWAY_ENVIRONMENT: "staging",
      CORS_ORIGIN_PATTERN: PLATFORM_PATTERN,
      FRONTEND_ORIGIN: "https://myapp.platform.example.com",
    });

    expect(includesRegex(origins, "https://myapp-staging.platform.example.com")).toBe(true);
  });

  it("fora da plataforma não libera o wildcard do CORS_ORIGIN_PATTERN", () => {
    const origins = buildCorsOrigins({
      CORS_ORIGIN_PATTERN: PLATFORM_PATTERN,
      FRONTEND_ORIGIN: "https://myapp.platform.example.com",
    });

    expect(includesRegex(origins, "https://myapp-staging.platform.example.com")).toBe(false);
  });

  it("na plataforma aceita os domínios do app (frontend e api) que casam com o padrão", () => {
    const origins = buildCorsOrigins({
      RAILWAY_ENVIRONMENT: "production",
      CORS_ORIGIN_PATTERN: PLATFORM_PATTERN,
    });

    expect(includesRegex(origins, "https://myapp.platform.example.com")).toBe(true);
    expect(includesRegex(origins, "https://myapp-api-production.platform.example.com")).toBe(true);
  });

  it("na plataforma REJEITA app de terceiro que não casa com o padrão", () => {
    const origins = buildCorsOrigins({
      RAILWAY_ENVIRONMENT: "production",
      CORS_ORIGIN_PATTERN: PLATFORM_PATTERN,
    });

    expect(includesRegex(origins, "https://evil-app.platform.example.com")).toBe(false);
    expect(includesRegex(origins, "https://notmyapp.platform.example.com")).toBe(false);
  });

  it("sem CORS_ORIGIN_PATTERN não adiciona wildcard mesmo na plataforma", () => {
    const origins = buildCorsOrigins({ RAILWAY_ENVIRONMENT: "production" });

    expect(origins.some((origin) => origin instanceof RegExp)).toBe(false);
  });
});
