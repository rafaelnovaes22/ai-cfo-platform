import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "@/channels/whatsapp/signature.js";

vi.mock("@/observability/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const SECRET = "meta-app-secret-test";

function sign(body: Buffer, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("whatsapp/signature — verifyMetaSignature", () => {
  const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));

  it("aceita assinatura válida do corpo bruto", () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejeita quando o corpo foi adulterado (assinatura não confere)", () => {
    const tampered = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "x" }] }));
    expect(verifyMetaSignature(tampered, sign(body), SECRET)).toBe(false);
  });

  it("rejeita assinatura gerada com outro secret", () => {
    expect(verifyMetaSignature(body, sign(body, "secret-do-atacante"), SECRET)).toBe(false);
  });

  it("fail-closed: secret ausente → false", () => {
    expect(verifyMetaSignature(body, sign(body), undefined)).toBe(false);
  });

  it("rejeita corpo bruto ausente", () => {
    expect(verifyMetaSignature(undefined, sign(body), SECRET)).toBe(false);
  });

  it("rejeita corpo bruto vazio", () => {
    expect(verifyMetaSignature(Buffer.alloc(0), sign(body), SECRET)).toBe(false);
  });

  it("rejeita header de assinatura ausente", () => {
    expect(verifyMetaSignature(body, undefined, SECRET)).toBe(false);
  });

  it("rejeita header em formato inesperado (sem prefixo sha256=)", () => {
    const hex = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyMetaSignature(body, hex, SECRET)).toBe(false);
  });

  it("rejeita header com hex malformado", () => {
    expect(verifyMetaSignature(body, "sha256=naoEhHex", SECRET)).toBe(false);
  });
});
