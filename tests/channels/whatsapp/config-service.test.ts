import { describe, expect, it, vi, beforeEach } from "vitest"

const findUniqueOrThrow = vi.fn()
const update = vi.fn()

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({ tenant: { findUniqueOrThrow, update } }),
}))

import { getWhatsappConfig, updateWhatsappConfig } from "@/channels/whatsapp/config-service.js"

const TENANT = "t-1"

beforeEach(() => {
  findUniqueOrThrow.mockReset()
  update.mockReset()
})

describe("whatsapp/config-service getWhatsappConfig", () => {
  it("serializa optInAt como ISO e expõe phone null", async () => {
    findUniqueOrThrow.mockResolvedValue({
      whatsappPhone: null,
      whatsappEnabled: false,
      whatsappOptInAt: null,
    })
    const view = await getWhatsappConfig(TENANT)
    expect(view).toEqual({ phone: null, enabled: false, optInAt: null })
  })
})

describe("whatsapp/config-service updateWhatsappConfig", () => {
  it("carimba optInAt ao habilitar com telefone já existente", async () => {
    findUniqueOrThrow.mockResolvedValue({
      whatsappPhone: "+5511999998888",
      whatsappEnabled: false,
      whatsappOptInAt: null,
    })
    update.mockResolvedValue({
      whatsappPhone: "+5511999998888",
      whatsappEnabled: true,
      whatsappOptInAt: new Date("2026-06-05T12:00:00.000Z"),
    })

    const view = await updateWhatsappConfig(TENANT, { enabled: true })

    const data = update.mock.calls[0][0].data
    expect(data.whatsappEnabled).toBe(true)
    expect(data.whatsappOptInAt).toBeInstanceOf(Date)
    expect(view.enabled).toBe(true)
    expect(view.optInAt).toBe("2026-06-05T12:00:00.000Z")
  })

  it("rejeita habilitar sem telefone configurado nem informado", async () => {
    findUniqueOrThrow.mockResolvedValue({
      whatsappPhone: null,
      whatsappEnabled: false,
      whatsappOptInAt: null,
    })
    await expect(updateWhatsappConfig(TENANT, { enabled: true })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("não toca optInAt ao apenas desabilitar (preserva histórico)", async () => {
    findUniqueOrThrow.mockResolvedValue({
      whatsappPhone: "+5511999998888",
      whatsappEnabled: true,
      whatsappOptInAt: new Date("2026-06-01T00:00:00.000Z"),
    })
    update.mockResolvedValue({
      whatsappPhone: "+5511999998888",
      whatsappEnabled: false,
      whatsappOptInAt: new Date("2026-06-01T00:00:00.000Z"),
    })

    await updateWhatsappConfig(TENANT, { enabled: false })

    const data = update.mock.calls[0][0].data
    expect(data.whatsappOptInAt).toBeUndefined()
    expect(data.whatsappEnabled).toBe(false)
  })
})
