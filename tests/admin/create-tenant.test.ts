import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa o serviço admin createTenant com Prisma mockado. Valida que o tenant
// nasce com plano/mode corretos (business/autonomous por padrão), senha
// temporária gerada, e que conflitos P2002 são mapeados para AdminError.

const txMock = {} as Record<string, { create: ReturnType<typeof vi.fn> }>;
const prismaMock = {
  $transaction: <T>(fn: (tx: typeof txMock) => Promise<T>) => fn(txMock),
};
vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => prismaMock,
}));

const bcryptMock = vi.fn().mockResolvedValue("hashed-pw");
vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => bcryptMock(...args) },
}));

const { Prisma } = await import("@prisma/client");
const { createTenant } = await import("@/admin/service.js");

describe("admin/createTenant", () => {
  beforeEach(() => {
    for (const key of Object.keys(txMock)) delete txMock[key];
    bcryptMock.mockClear();
  });

  it("cria tenant premium com defaults business/autonomous", async () => {
    txMock.tenant = {
      create: vi.fn().mockResolvedValue({ id: "t-1", name: "Cliente Premium" }),
    };
    txMock.user = {
      create: vi.fn().mockResolvedValue({ id: "u-1", email: "ceo@x.com" }),
    };
    txMock.subscription = { create: vi.fn().mockResolvedValue({}) };

    const result = await createTenant({
      tenantName: "Cliente Premium",
      email: "CEO@x.com",
      name: "CEO",
    });

    expect(result.tenantId).toBe("t-1");
    expect(result.userId).toBe("u-1");
    expect(result.email).toBe("ceo@x.com"); // normalizado lowercase
    expect(result.plan).toBe("business");
    expect(result.mode).toBe("autonomous");
    expect(result.status).toBe("active");
    expect(result.tempPassword).toMatch(/^[0-9a-f]{16}$/);

    // Subscription criada com plan business, mode autonomous, status active
    expect(txMock.subscription.create).toHaveBeenCalledWith({
      data: { tenantId: "t-1", plan: "business", mode: "autonomous", status: "active" },
    });
  });

  it("respeita plan/mode customizados", async () => {
    txMock.tenant = { create: vi.fn().mockResolvedValue({ id: "t-2", name: "X" }) };
    txMock.user = { create: vi.fn().mockResolvedValue({ id: "u-2", email: "x@y.com" }) };
    txMock.subscription = { create: vi.fn().mockResolvedValue({}) };

    const result = await createTenant({
      tenantName: "X",
      email: "x@y.com",
      name: "X",
      plan: "pro",
      mode: "assisted",
    });

    expect(result.plan).toBe("pro");
    expect(result.mode).toBe("assisted");
    expect(txMock.subscription.create).toHaveBeenCalledWith({
      data: { tenantId: "t-2", plan: "pro", mode: "assisted", status: "active" },
    });
  });

  it("mapeia P2002 email para AdminError 409", async () => {
    txMock.tenant = { create: vi.fn().mockResolvedValue({ id: "t-3" }) };
    txMock.user = {
      create: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "6.0.0",
          meta: { target: ["email"] },
        }),
      ),
    };

    await expect(
      createTenant({ tenantName: "Dup", email: "dup@x.com", name: "Dup" }),
    ).rejects.toMatchObject({ name: "AdminError", statusCode: 409, message: "E-mail já cadastrado" });
  });

  it("mapeia P2002 cnpj para AdminError 409", async () => {
    txMock.tenant = {
      create: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "6.0.0",
          meta: { target: ["cnpj"] },
        }),
      ),
    };

    await expect(
      createTenant({ tenantName: "Dup", email: "c@x.com", name: "C", cnpj: "123" }),
    ).rejects.toMatchObject({ name: "AdminError", statusCode: 409, message: "CNPJ já cadastrado" });
  });

  it("mapeia P2002 whatsappPhone para AdminError 409", async () => {
    txMock.tenant = {
      create: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "6.0.0",
          meta: { target: ["whatsappPhone"] },
        }),
      ),
    };

    await expect(
      createTenant({
        tenantName: "Dup",
        email: "w@x.com",
        name: "W",
        phone: "+5511999998888",
      }),
    ).rejects.toMatchObject({
      name: "AdminError",
      statusCode: 409,
      message: "Número de WhatsApp já vinculado a outra conta",
    });
  });
});
