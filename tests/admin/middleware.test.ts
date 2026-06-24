import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa o middleware requireAdminKey: rejeita quando ADMIN_API_KEY não
// configurada, quando header ausente, e quando chave não bate. Aceita quando
// hash bate em tempo constante.

const problemDetailMock = vi.fn((x: unknown) => x);
vi.mock("@/http/problem-detail.js", () => ({
  problemDetail: (x: unknown) => problemDetailMock(x),
}));

const loggerMock = { warn: vi.fn(), error: vi.fn() };
vi.mock("@/observability/logger.js", () => ({ logger: loggerMock }));

const { requireAdminKey } = await import("@/admin/middleware.js");

function makeReqReply(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    ip: "127.0.0.1",
    url: "/admin/tenants",
  } as any;
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
  return { req, reply };
}

describe("admin/requireAdminKey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    problemDetailMock.mockImplementation((x: unknown) => x);
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();
  });

  it("retorna 503 quando ADMIN_API_KEY não configurada", async () => {
    delete process.env.ADMIN_API_KEY;
    const { req, reply } = makeReqReply("Bearer key");
    await requireAdminKey(req, reply);
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("retorna 401 quando Authorization ausente", async () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const { req, reply } = makeReqReply();
    await requireAdminKey(req, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("retorna 403 quando chave não bate", async () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const { req, reply } = makeReqReply("Bearer wrong-key");
    await requireAdminKey(req, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it("passa quando chave bate", async () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const { req, reply } = makeReqReply("Bearer secret-key");
    await requireAdminKey(req, reply);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("não aceita formato diferente de Bearer", async () => {
    process.env.ADMIN_API_KEY = "secret-key";
    const { req, reply } = makeReqReply("Token secret-key");
    await requireAdminKey(req, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });
});
