// Regressão dos bugs corrigidos no sweep de 2026-06-08 (reclamação da CEO).
import { describe, it, expect, vi } from "vitest"
import { normalizeAmountCents, detectColumns } from "@/ingest/normalize.js"
import { classifyCommand } from "@/channels/whatsapp/message-parser.js"

vi.mock("@/persistence/prisma.js", () => ({ getPrisma: () => ({}) }))
import { requireRole } from "@/auth/middleware.js"

describe("normalizeAmountCents — formatos de valor (#22, #23)", () => {
  it("formato US 1,234.56 → 123456 centavos (não 123)", () => {
    expect(normalizeAmountCents("1,234.56")).toBe(123456)
  })
  it("formato BR 1.234,56 → 123456 centavos", () => {
    expect(normalizeAmountCents("1.234,56")).toBe(123456)
  })
  it("sinal negativo à direita (Totvs) 1.234,56- → -123456", () => {
    expect(normalizeAmountCents("1.234,56-")).toBe(-123456)
  })
  it("parênteses contábeis (1.234,56) → -123456", () => {
    expect(normalizeAmountCents("(1.234,56)")).toBe(-123456)
  })
  it("US com milhar e decimal 1,234,567.89 → 123456789", () => {
    expect(normalizeAmountCents("1,234,567.89")).toBe(123456789)
  })
})

describe("detectColumns — coluna única de crédito/débito (#41)", () => {
  it("só 'Crédito (R$)' vira coluna de valor com direção implícita credit", () => {
    const cols = detectColumns(["Data", "Histórico", "Crédito (R$)"])
    expect(cols.amountIdx).toBe(2)
    expect(cols.impliedDirection).toBe("credit")
  })
  it("só 'Débito' vira coluna de valor com direção implícita debit", () => {
    const cols = detectColumns(["Data", "Descrição", "Débito"])
    expect(cols.amountIdx).toBe(2)
    expect(cols.impliedDirection).toBe("debit")
  })
  it("crédito E débito juntos → colunas split, sem impliedDirection", () => {
    const cols = detectColumns(["Data", "Histórico", "Crédito", "Débito"])
    expect(cols.creditIdx).toBe(2)
    expect(cols.debitIdx).toBe(3)
    expect(cols.impliedDirection).toBeNull()
  })
})

describe("classifyCommand — seleção numérica do menu (#18)", () => {
  it("'1' → CAIXA, '2' → SEMANA, '3' → ANALISE", () => {
    expect(classifyCommand("1")).toBe("CAIXA")
    expect(classifyCommand("2")).toBe("SEMANA")
    expect(classifyCommand("3")).toBe("ANALISE")
  })
  it("comandos de texto continuam funcionando", () => {
    expect(classifyCommand("caixa")).toBe("CAIXA")
    expect(classifyCommand("análise")).toBe("ANALISE")
  })
})

describe("requireRole — corpo ProblemDetail no 403 (#12/#11/#20/#21)", () => {
  it("403 responde ProblemDetail (type/title/status), não { message }", async () => {
    const reply = {
      statusCode: 0,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code
        return this
      },
      send(payload: unknown) {
        this.body = payload
        return this
      },
    }
    const guard = requireRole("admin")
    await guard(
      { auth: { userId: "u", tenantId: "t", role: "viewer", kind: "user", scopes: null } } as never,
      reply as never,
    )
    expect(reply.statusCode).toBe(403)
    expect(reply.body).toMatchObject({ type: expect.any(String), title: expect.any(String), status: 403 })
    expect((reply.body as Record<string, unknown>).message).toBeUndefined()
  })
})
