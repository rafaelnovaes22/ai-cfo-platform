import { describe, it, expect, vi } from "vitest";
import { requireScope } from "@/auth/middleware.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext } from "@/auth/middleware.js";

// Helper que monta um pseudo-request com o auth context desejado.
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

function mockReq(auth: AuthContext | null): FastifyRequest {
  return { auth } as unknown as FastifyRequest;
}

describe("auth/requireScope", () => {
  it("usuário humano (kind=user) passa sem checar scope", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "u1",
        tenantId: "t1",
        role: "admin",
        kind: "user",
        scopes: null,
      }),
      reply,
    );
    expect(reply.statusCode).toBe(0);
  });

  it("API token com scope exigido passa", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "api-token",
        tenantId: "t1",
        role: "api",
        kind: "api_token",
        scopes: ["ingest:write", "ingest:read"],
      }),
      reply,
    );
    expect(reply.statusCode).toBe(0);
  });

  it("API token com scope wildcard (*) passa", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "api-token",
        tenantId: "t1",
        role: "api",
        kind: "api_token",
        scopes: ["*"],
      }),
      reply,
    );
    expect(reply.statusCode).toBe(0);
  });

  it("API token SEM scope exigido → 403 com RFC 7807", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "api-token",
        tenantId: "t1",
        role: "api",
        kind: "api_token",
        scopes: ["hub:read"],
      }),
      reply,
    );
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({
      type: expect.stringContaining("scope-missing"),
      status: 403,
    });
  });

  it("API token sem nenhum scope (vazio) → 403", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "api-token",
        tenantId: "t1",
        role: "api",
        kind: "api_token",
        scopes: [],
      }),
      reply,
    );
    expect(reply.statusCode).toBe(403);
  });

  it("API token passa se TIVER QUALQUER UM dos scopes alternativos", async () => {
    const guard = requireScope("ingest:write", "ingest:admin");
    const reply = mockReply();
    await guard(
      mockReq({
        userId: "api-token",
        tenantId: "t1",
        role: "api",
        kind: "api_token",
        scopes: ["ingest:admin"],
      }),
      reply,
    );
    expect(reply.statusCode).toBe(0);
  });

  it("request sem auth → 401", async () => {
    const guard = requireScope("ingest:write");
    const reply = mockReply();
    await guard(mockReq(null), reply);
    expect(reply.statusCode).toBe(401);
  });
});

// Smoke test garantindo que o tipo AuthContext contém os campos esperados.
describe("auth/AuthContext shape", () => {
  it("tem kind e scopes", () => {
    const auth: AuthContext = {
      userId: "u1",
      tenantId: "t1",
      role: "admin",
      kind: "user",
      scopes: null,
    };
    expect(auth.kind).toBe("user");
    expect(auth.scopes).toBeNull();
  });
});

// vi não é usado aqui, mas a importação garante que o vitest matchers extras estão OK.
void vi;
