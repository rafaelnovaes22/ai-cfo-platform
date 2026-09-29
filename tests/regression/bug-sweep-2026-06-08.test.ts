// Regressão dos bugs corrigidos no sweep de 2026-06-08 (reclamação da CEO).
import { describe, it, expect, vi } from "vitest"
import { normalizeAmountCents, detectColumns } from "@/ingest/normalize.js"
import { classifyCommand } from "@/channels/whatsapp/message-parser.js"
import { formatUnknownHint } from "@/channels/whatsapp/response-formatter.js"

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
  it("pedido em linguagem natural (palavra em qualquer posição) → comando", () => {
    expect(classifyCommand("me mostra meu caixa")).toBe("CAIXA")
    expect(classifyCommand("qual o saldo de hoje?")).toBe("CAIXA")
    expect(classifyCommand("oi, me manda o resumo da semana")).toBe("SEMANA")
    expect(classifyCommand("quero ver minha análise do mês")).toBe("ANALISE")
    expect(classifyCommand("como estou?")).toBe("STATUS")
  })
  it("pedido tem prioridade sobre saudação", () => {
    expect(classifyCommand("oi, me mostra o caixa")).toBe("CAIXA")
  })
  it("substring cru não casa (foi ≠ oi, oito ≠ oi)", () => {
    expect(classifyCommand("foi trabalhar")).toBe("UNKNOWN")
    expect(classifyCommand("cheguei as oito")).toBe("UNKNOWN")
  })
})

describe("formatUnknownHint — dica curta, sem despejar o menu", () => {
  it("convida linguagem natural e cita o menu como opção", () => {
    const hint = formatUnknownHint("pro")
    expect(hint).toContain("caixa de hoje")
    expect(hint).toContain("*menu*")
    expect(hint).not.toContain("1️⃣")
  })
  it("plano student centra no extrato", () => {
    const hint = formatUnknownHint("student")
    expect(hint).toContain("extrato")
    expect(hint).not.toContain("1️⃣")
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
