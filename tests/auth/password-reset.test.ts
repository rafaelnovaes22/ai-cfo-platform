import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// vi.hoisted() lifta a declaração junto com vi.mock — sem ReferenceError.
const mocks = vi.hoisted(() => {
  const userFindUniqueMock = vi.fn();
  const userUpdateMock = vi.fn();
  const passwordResetCreateMock = vi.fn();
  const passwordResetFindUniqueMock = vi.fn();
  const passwordResetUpdateMock = vi.fn();
  const sessionUpdateManyMock = vi.fn();
  const sendEmailMock = vi.fn(async () => ({ delivered: true, provider: "resend" as const }));
  return {
    userFindUniqueMock,
    userUpdateMock,
    passwordResetCreateMock,
    passwordResetFindUniqueMock,
    passwordResetUpdateMock,
    sessionUpdateManyMock,
    sendEmailMock,
  };
});

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    user: { findUnique: mocks.userFindUniqueMock },
    passwordResetToken: {
      create: mocks.passwordResetCreateMock,
      findUnique: mocks.passwordResetFindUniqueMock,
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { update: mocks.userUpdateMock },
        passwordResetToken: { update: mocks.passwordResetUpdateMock },
        session: { updateMany: mocks.sessionUpdateManyMock },
      }),
  }),
}));

vi.mock("@/observability/email.js", () => ({
  sendEmail: mocks.sendEmailMock,
  isEmailConfigured: () => true,
}));

import {
  requestPasswordReset,
  confirmPasswordReset,
} from "@/auth/password-reset.js";
import { AuthError } from "@/auth/service.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
});

function firstCallArg<T = unknown>(mock: { mock: { calls: unknown[][] } }): T {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("mock não foi chamado");
  return call[0] as T;
}

describe("password-reset/requestPasswordReset", () => {
  it("cria token e dispara email quando usuário existe", async () => {
    mocks.userFindUniqueMock.mockResolvedValueOnce({
      id: "u1",
      email: "ana@acme.com",
      name: "Ana",
    });

    await requestPasswordReset("Ana@Acme.com  ");

    expect(mocks.userFindUniqueMock).toHaveBeenCalledWith({ where: { email: "ana@acme.com" } });
    expect(mocks.passwordResetCreateMock).toHaveBeenCalledOnce();
    const createArg = firstCallArg<{ data: { userId: string; tokenHash: string; expiresAt: Date } }>(
      mocks.passwordResetCreateMock,
    );
    expect(createArg.data.userId).toBe("u1");
    expect(createArg.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mocks.sendEmailMock).toHaveBeenCalledOnce();
    const sent = firstCallArg<{ to: string; text: string }>(mocks.sendEmailMock);
    expect(sent.to).toBe("ana@acme.com");
    expect(sent.text).toContain("/reset-password?token=");
  });

  it("não vaza existência: retorna sucesso silencioso para email inexistente", async () => {
    mocks.userFindUniqueMock.mockResolvedValueOnce(null);

    await expect(requestPasswordReset("ghost@nope.com")).resolves.toBeUndefined();
    expect(mocks.passwordResetCreateMock).not.toHaveBeenCalled();
    expect(mocks.sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("password-reset/confirmPasswordReset", () => {
  it("happy path: troca senha, marca token usado, revoga sessões", async () => {
    const raw = "a".repeat(64);
    mocks.passwordResetFindUniqueMock.mockResolvedValueOnce({
      id: "tok1",
      userId: "u1",
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
      user: { id: "u1", email: "ana@acme.com" },
    });

    await confirmPasswordReset(raw, "novaSenhaSegura1");

    expect(mocks.userUpdateMock).toHaveBeenCalledOnce();
    const update = firstCallArg<{ where: { id: string }; data: { passwordHash: string } }>(
      mocks.userUpdateMock,
    );
    expect(update.where.id).toBe("u1");
    expect(update.data.passwordHash).toMatch(/^\$2[aby]\$/);

    expect(mocks.passwordResetUpdateMock).toHaveBeenCalledOnce();
    const upd = firstCallArg<{ data: { usedAt: Date } }>(mocks.passwordResetUpdateMock);
    expect(upd.data.usedAt).toBeInstanceOf(Date);

    expect(mocks.sessionUpdateManyMock).toHaveBeenCalledOnce();
    const sess = firstCallArg<{ where: { userId: string } }>(mocks.sessionUpdateManyMock);
    expect(sess.where.userId).toBe("u1");
  });

  it("rejeita token inexistente", async () => {
    mocks.passwordResetFindUniqueMock.mockResolvedValueOnce(null);
    await expect(confirmPasswordReset("xxxxxx", "novaSenha1")).rejects.toBeInstanceOf(AuthError);
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("rejeita token já utilizado", async () => {
    const raw = "b".repeat(64);
    mocks.passwordResetFindUniqueMock.mockResolvedValueOnce({
      id: "t",
      userId: "u1",
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: new Date(Date.now() - 1000),
      user: { id: "u1", email: "x@x.com" },
    });
    await expect(confirmPasswordReset(raw, "novaSenha1")).rejects.toThrow(/utilizado/);
  });

  it("rejeita token expirado", async () => {
    const raw = "c".repeat(64);
    mocks.passwordResetFindUniqueMock.mockResolvedValueOnce({
      id: "t",
      userId: "u1",
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      user: { id: "u1", email: "x@x.com" },
    });
    await expect(confirmPasswordReset(raw, "novaSenha1")).rejects.toThrow(/expirado/);
  });

  it("rejeita senha curta antes mesmo de tocar o banco", async () => {
    await expect(confirmPasswordReset("any", "curta")).rejects.toThrow(/8 caracteres/);
    expect(mocks.passwordResetFindUniqueMock).not.toHaveBeenCalled();
  });

  it("revoga TODAS as sessões ativas após reset (defesa contra hijack)", async () => {
    const raw = "d".repeat(64);
    mocks.passwordResetFindUniqueMock.mockResolvedValueOnce({
      id: "t",
      userId: "u9",
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
      user: { id: "u9", email: "z@z.com" },
    });
    await confirmPasswordReset(raw, "outraSenha1234");
    const where = firstCallArg<{ where: { userId: string; revokedAt: null } }>(
      mocks.sessionUpdateManyMock,
    ).where;
    expect(where.userId).toBe("u9");
    expect(where.revokedAt).toBeNull();
  });
});
