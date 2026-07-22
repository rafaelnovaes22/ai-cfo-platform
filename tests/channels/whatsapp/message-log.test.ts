import { describe, expect, it, vi, beforeEach } from "vitest"

const create = vi.fn()
const findMany = vi.fn()
const deleteMany = vi.fn()
const updateMany = vi.fn()

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({ whatsappMessage: { create, findMany, deleteMany, updateMany } }),
}))
vi.mock("@/observability/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  logOutbound,
  logSkipped,
  logInbound,
  updateStatusByProviderId,
  listMessages,
  purgeExpiredMessages,
} from "@/channels/whatsapp/message-log.js"

const TENANT = "t-1"

beforeEach(() => {
  create.mockReset().mockResolvedValue({})
  findMany.mockReset()
  deleteMany.mockReset()
  updateMany.mockReset().mockResolvedValue({ count: 0 })
})

describe("message-log redação (ADR-018 §5)", () => {
  it("redige o body de daily_cashflow — não persiste valores", async () => {
    await logOutbound({
      tenantId: TENANT,
      kind: "daily_cashflow",
      body: "💰 Saldo: R$ 10.000,00\n⬆️ Entradas: R$ 3.600,00",
      result: { messageId: "wamid.1", status: "queued" },
    })
    const data = create.mock.calls[0][0].data
    expect(data.body).not.toContain("10.000")
    expect(data.body).toContain("valores omitidos")
    expect(data.status).toBe("sent") // queued → sent
    expect(data.providerMessageId).toBe("wamid.1")
  })

  it("mantém o body de analysis_ready (já não-sensível)", async () => {
    await logOutbound({
      tenantId: TENANT,
      kind: "analysis_ready",
      body: "✅ Análise pronta — maio/2026",
      result: { messageId: "wamid.2", status: "queued" },
    })
    expect(create.mock.calls[0][0].data.body).toContain("Análise pronta")
  })

  it("envio falho → status failed e providerMessageId null", async () => {
    await logOutbound({
      tenantId: TENANT,
      kind: "analysis_ready",
      body: "x",
      result: { messageId: "", status: "failed", error: "boom" },
    })
    const data = create.mock.calls[0][0].data
    expect(data.status).toBe("failed")
    expect(data.providerMessageId).toBeNull()
    expect(data.error).toBe("boom")
  })
})

describe("message-log skipped/inbound", () => {
  it("logSkipped grava skipped_disabled com body redigido", async () => {
    await logSkipped({ tenantId: TENANT, kind: "daily_cashflow" })
    const data = create.mock.calls[0][0].data
    expect(data.status).toBe("skipped_disabled")
    expect(data.direction).toBe("outbound")
    expect(data.providerMessageId).toBeNull()
    expect(data.body).toContain("valores omitidos")
  })

  it("logInbound não retém texto livre do usuário", async () => {
    await logInbound({ tenantId: TENANT, providerMessageId: "wamid.in" })
    const data = create.mock.calls[0][0].data
    expect(data.direction).toBe("inbound")
    expect(data.kind).toBe("reply")
    expect(data.body).toBe("(mensagem recebida do usuário)")
    expect(data.providerMessageId).toBe("wamid.in")
  })

  it("create que falha não propaga exceção (log é observabilidade)", async () => {
    create.mockRejectedValueOnce(new Error("db down"))
    await expect(logSkipped({ tenantId: TENANT, kind: "analysis_ready" })).resolves.toBeUndefined()
  })
})

describe("message-log listagem paginada", () => {
  it("retorna nextCursor quando há mais que o limite", async () => {
    // limit 2 → service pede take 3; 3 linhas = há próxima página
    findMany.mockResolvedValue([
      row("a"),
      row("b"),
      row("c"),
    ])
    const page = await listMessages({ tenantId: TENANT, limit: 2 })
    expect(page.items.map((i) => i.id)).toEqual(["a", "b"])
    expect(page.nextCursor).toBe("b")
    // confirma take = limit + 1
    expect(findMany.mock.calls[0][0].take).toBe(3)
  })

  it("nextCursor null quando não excede o limite", async () => {
    findMany.mockResolvedValue([row("a")])
    const page = await listMessages({ tenantId: TENANT, limit: 2 })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })

  it("aplica cursor com skip 1", async () => {
    findMany.mockResolvedValue([])
    await listMessages({ tenantId: TENANT, limit: 20, cursor: "x" })
    const args = findMany.mock.calls[0][0]
    expect(args.cursor).toEqual({ id: "x" })
    expect(args.skip).toBe(1)
  })
})

describe("message-log retenção", () => {
  it("purge deleta antes do cutoff e retorna a contagem", async () => {
    deleteMany.mockResolvedValue({ count: 5 })
    const removed = await purgeExpiredMessages(180)
    expect(removed).toBe(5)
    const where = deleteMany.mock.calls[0][0].where
    expect(where.createdAt.lt).toBeInstanceOf(Date)
  })

  it("updateStatusByProviderId atualiza só outbound", async () => {
    await updateStatusByProviderId("wamid.9", "read")
    const args = updateMany.mock.calls[0][0]
    expect(args.where).toEqual({ providerMessageId: "wamid.9", direction: "outbound" })
    expect(args.data).toEqual({ status: "read" })
  })
})

function row(id: string) {
  return {
    id,
    direction: "outbound",
    kind: "daily_cashflow",
    body: "x",
    status: "sent",
    providerMessageId: null,
    error: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
  }
}
