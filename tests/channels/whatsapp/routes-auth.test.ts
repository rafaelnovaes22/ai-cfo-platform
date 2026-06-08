import { describe, expect, it, vi } from "vitest"
import Fastify from "fastify"
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"

// requireAuth no caminho "sem header" não toca Prisma — mockamos por segurança.
vi.mock("@/persistence/prisma.js", () => ({ getPrisma: () => ({}) }))
vi.mock("@/observability/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { whatsappConfigRoutes } from "@/channels/whatsapp/config-routes.js"
import { whatsappMessagesRoutes } from "@/channels/whatsapp/messages-routes.js"

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.decorateRequest("auth", null)
  await app.register(whatsappConfigRoutes)
  await app.register(whatsappMessagesRoutes)
  await app.ready()
  return app
}

// Regressão: declarar 401/403 como ProblemDetail no response schema quebrava a
// serialização do { message } enviado por requireAuth → 500. Deve ser 401.
describe("whatsapp routes — auth sem header retorna 401 (não 500)", () => {
  it("GET /config/whatsapp → 401", async () => {
    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/config/whatsapp" })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it("PATCH /config/whatsapp → 401", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: "PATCH",
      url: "/config/whatsapp",
      payload: { enabled: true },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it("GET /whatsapp/messages → 401", async () => {
    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/whatsapp/messages" })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
