import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";

// Mock do Prisma — requireMode consulta subscription.mode no DB.
const subscriptionFindUniqueMock = vi.fn();
vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    subscription: { findUnique: subscriptionFindUniqueMock },
    apiToken:     { findUnique: vi.fn(), update: vi.fn() },
  }),
}));

import { requireMode, requireRole } from "@/auth/middleware.js";
import type { AuthContext } from "@/auth/middleware.js";

function mockReply() {
  const reply = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return reply as unknown as FastifyReply & { statusCode: number; body: unknown };
}

function reqWith(auth: AuthContext | null): FastifyRequest {
  return { auth } as unknown as FastifyRequest;
}

const adminUser: AuthContext = {
  userId: "u1", tenantId: "t1", role: "admin",
  kind: "user", scopes: null,
};

beforeEach(() => {
  subscriptionFindUniqueMock.mockReset();
});

describe("auth/requireMode — C4 enforcement", () => {
  it("permite quando subscription.mode está na lista", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "assisted" });
    const guard = requireMode("assisted");
    const reply = mockReply();
    await guard(reqWith(adminUser), reply);
    expect(reply.statusCode).toBe(0); // não foi setado
    expect(subscriptionFindUniqueMock).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      select: { mode: true },
    });
  });

  it("bloqueia com 403 RFC 7807 quando modo está fora", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "shadow" });
    const guard = requireMode("assisted");
    const reply = mockReply();
    await guard(reqWith(adminUser), reply);
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({
      type: expect.stringContaining("mode-not-allowed"),
      status: 403,
    });
  });

  it("trata subscription ausente como modo 'shadow' (safe default)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue(null);
    const guard = requireMode("assisted");
    const reply = mockReply();
    await guard(reqWith(adminUser), reply);
    expect(reply.statusCode).toBe(403); // shadow ≠ assisted
  });

  it("aceita múltiplos modos permitidos", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "autonomous" });
    const guard = requireMode("assisted", "autonomous");
    const reply = mockReply();
    await guard(reqWith(adminUser), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("retorna 401 quando request não tem auth", async () => {
    const guard = requireMode("assisted");
    const reply = mockReply();
    await guard(reqWith(null), reply);
    expect(reply.statusCode).toBe(401);
    expect(subscriptionFindUniqueMock).not.toHaveBeenCalled();
  });

  it("query usa tenantId do auth, nunca de path/query/body", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "assisted" });
    const guard = requireMode("assisted");
    await guard(reqWith({ ...adminUser, tenantId: "tenant-from-jwt" }), mockReply());
    const call = subscriptionFindUniqueMock.mock.calls[0]?.[0] as { where: { tenantId: string } };
    expect(call.where.tenantId).toBe("tenant-from-jwt");
  });
});

describe("auth/requireRole — RBAC", () => {
  it("permite quando role bate", async () => {
    const guard = requireRole("admin");
    const reply = mockReply();
    await guard(reqWith(adminUser), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("bloqueia com 403 quando role não bate", async () => {
    const guard = requireRole("admin");
    const reply = mockReply();
    await guard(reqWith({ ...adminUser, role: "viewer" }), reply);
    expect(reply.statusCode).toBe(403);
  });

  it("aceita múltiplas roles", async () => {
    const guard = requireRole("admin", "editor");
    const reply = mockReply();
    await guard(reqWith({ ...adminUser, role: "editor" }), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("bloqueia API tokens quando exige role humana", async () => {
    const guard = requireRole("admin");
    const reply = mockReply();
    await guard(
      reqWith({ userId: "api", tenantId: "t1", role: "api", kind: "api_token", scopes: [] }),
      reply,
    );
    expect(reply.statusCode).toBe(403); // "api" ≠ "admin"
  });

  it("bloqueia quando auth é null", async () => {
    const guard = requireRole("admin");
    const reply = mockReply();
    await guard(reqWith(null), reply);
    expect(reply.statusCode).toBe(403);
  });
});
