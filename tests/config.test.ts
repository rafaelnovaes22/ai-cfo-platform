import { describe, it, expect } from "vitest";
import { validateEnv } from "@/config.js";

// Base mínima viável (dev) — só o incontestável + um provider LLM.
const devBase: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(16),
  GOOGLE_API_KEY: "ai-studio-key",
  NODE_ENV: "development",
};

describe("validateEnv", () => {
  it("dev: base mínima passa (REDIS/ADMIN/Stripe viram warning, não erro)", () => {
    const r = validateEnv(devBase);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("falha sem DATABASE_URL ou JWT_SECRET em qualquer ambiente", () => {
    const r = validateEnv({ GOOGLE_API_KEY: "k", NODE_ENV: "development" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
    expect(r.errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
  });

  it("falha quando nenhum provider LLM está configurado", () => {
    const { GOOGLE_API_KEY, ...noLlm } = devBase;
    const r = validateEnv(noLlm);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("provider LLM"))).toBe(true);
  });

  it("aceita Vertex (GOOGLE_CLOUD_PROJECT) como provider LLM", () => {
    const { GOOGLE_API_KEY, ...rest } = devBase;
    const r = validateEnv({ ...rest, GOOGLE_CLOUD_PROJECT: "aicfo-497016" });
    expect(r.ok).toBe(true);
  });

  it("valida formato: DATABASE_URL malformada é erro", () => {
    const r = validateEnv({ ...devBase, DATABASE_URL: "não-é-url" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
  });

  it("WhatsApp: META_ACCESS_TOKEN sem META_APP_SECRET é erro (fail-closed)", () => {
    const r = validateEnv({ ...devBase, META_ACCESS_TOKEN: "tok" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("META_APP_SECRET"))).toBe(true);
  });

  it("prod sem subsistemas (Redis/Admin/Stripe): SOBE com warnings, não aborta", () => {
    // Regressão: marcar subsistemas como fatais derrubou o staging (sem Stripe).
    // Eles avisam mas não impedem a boot — têm fail-fast próprio no uso/fallback.
    const r = validateEnv({
      DATABASE_URL: "postgresql://u:p@host:5432/db",
      JWT_SECRET: "x".repeat(16),
      GOOGLE_CLOUD_PROJECT: "aicfo-497016",
      RAILWAY_ENVIRONMENT: "production",
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings.some((w) => w.includes("STRIPE_SECRET_KEY"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("REDIS_URL"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("ADMIN_API_KEY"))).toBe(true);
  });

  it("prod completo passa", () => {
    const r = validateEnv({
      DATABASE_URL: "postgresql://u:p@host:5432/db",
      REDIS_URL: "redis://host:6379",
      JWT_SECRET: "x".repeat(16),
      ADMIN_API_KEY: "admin",
      GOOGLE_CLOUD_PROJECT: "aicfo-497016",
      STRIPE_SECRET_KEY: "sk_live_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      LANGSMITH_API_KEY: "lsv2_x",
      RAILWAY_ENVIRONMENT: "production",
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
