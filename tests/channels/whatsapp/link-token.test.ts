import { describe, it, expect, beforeAll } from "vitest"
import { SignJWT } from "jose"
import {
  signWhatsAppLinkToken,
  verifyWhatsAppLinkToken,
  appBaseUrl,
} from "@/channels/whatsapp/link-token.js"

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-para-link-token-aaaaaaaaaaaaaaaa"
})

describe("link-token sign/verify", () => {
  it("round-trip: assina e verifica devolvendo o telefone", async () => {
    const token = await signWhatsAppLinkToken("+5511999998888")
    expect(await verifyWhatsAppLinkToken(token)).toBe("+5511999998888")
  })

  it("rejeita token com purpose errado", async () => {
    const key = new TextEncoder().encode(process.env.JWT_SECRET)
    const bad = await new SignJWT({ whatsappPhone: "+5511999998888", purpose: "outra_coisa" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key)
    await expect(verifyWhatsAppLinkToken(bad)).rejects.toThrow()
  })

  it("rejeita token assinado com outro segredo", async () => {
    const key = new TextEncoder().encode("segredo-diferente-bbbbbbbbbbbbbbbbbbbbbbbb")
    const bad = await new SignJWT({ whatsappPhone: "+5511999998888", purpose: "whatsapp_link" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key)
    await expect(verifyWhatsAppLinkToken(bad)).rejects.toThrow()
  })

  it("rejeita token expirado", async () => {
    const key = new TextEncoder().encode(process.env.JWT_SECRET)
    const expired = await new SignJWT({ whatsappPhone: "+5511999998888", purpose: "whatsapp_link" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key)
    await expect(verifyWhatsAppLinkToken(expired)).rejects.toThrow()
  })

  it("appBaseUrl reflete APP_URL e remove barra final", () => {
    process.env.APP_URL = "https://app.acme-example.com/"
    expect(appBaseUrl()).toBe("https://app.acme-example.com")
  })

  it("appBaseUrl usa o placeholder padrão quando APP_URL/APP_BASE_URL não estão definidos", () => {
    delete process.env.APP_URL
    delete process.env.APP_BASE_URL
    expect(appBaseUrl()).toBe("https://app.example.com")
  })
})
