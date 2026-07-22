import { describe, it, expect } from "vitest";
import { isSubscriber, SUBSCRIBER_PLANS } from "@/auth/subscription-access.js";

describe("auth/isSubscriber — quem acessa o app web", () => {
  it("planos pagos ativos são assinantes", () => {
    for (const plan of SUBSCRIBER_PLANS) {
      expect(isSubscriber(plan, "active"), plan).toBe(true);
    }
  });

  it("lead (student/trial) nunca é assinante, mesmo ativo", () => {
    expect(isSubscriber("student", "active")).toBe(false);
    expect(isSubscriber("trial", "active")).toBe(false);
  });

  it("plano pago não-ativo não é assinante", () => {
    expect(isSubscriber("pro", "past_due")).toBe(false);
    expect(isSubscriber("pro", "canceled")).toBe(false);
    expect(isSubscriber("pro", "paused")).toBe(false);
  });

  it("nulos/ausentes não são assinante", () => {
    expect(isSubscriber(null, "active")).toBe(false);
    expect(isSubscriber("pro", null)).toBe(false);
    expect(isSubscriber(undefined, undefined)).toBe(false);
  });
});
