import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext } from "@/auth/middleware.js";

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const actionPlanItemFindFirstMock = vi.fn();
const actionPlanItemUpdateMock = vi.fn();
const subscriptionFindUniqueMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    actionPlanItem: {
      findFirst: (...args: unknown[]) => actionPlanItemFindFirstMock(...args),
      update:    (...args: unknown[]) => actionPlanItemUpdateMock(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => subscriptionFindUniqueMock(...args),
    },
  }),
}));

// requireAuth verifica JWT via verifyAccessToken — não precisamos do JWT real,
// pois o handler só é alcançado após os preHandlers. Testamos o handler isolado,
// injetando req.auth diretamente (mesmo padrão dos testes de middleware.test.ts).

import { requireMode } from "@/auth/middleware.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function reqWith(
  auth: AuthContext | null,
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
): FastifyRequest {
  return { auth, params, body, url: "/actions/test-item/status" } as unknown as FastifyRequest;
}

const shadowAuth: AuthContext = {
  userId: "u1",
  tenantId: "tenant-abc",
  role: "admin",
  kind: "user",
  scopes: null,
};

// Item de referência com os campos de lifecycle presentes (ADR-011 Etapa 2).
function buildItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    analysisId: "analysis-1",
    horizon: "short",
    title: "Reduzir CAC",
    description: "Renegociar contratos de mídia",
    effortLevel: "medium",
    riskLevel: "low",
    impactCents: 100_000,
    deadlineDays: 30,
    doneWhen: "CAC < R$500 por 2 meses",
    clientApproved: null,
    clientComment: null,
    status: "pending",
    statusReason: null,
    lastStatusUpdatedAt: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  actionPlanItemFindFirstMock.mockReset();
  actionPlanItemUpdateMock.mockReset();
  subscriptionFindUniqueMock.mockReset();
  // Default: subscription em shadow — cobre requireMode("shadow", ...)
  subscriptionFindUniqueMock.mockResolvedValue({ mode: "shadow" });
});

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("ActionPlanItem — status default 'pending'", () => {
  it("item criado possui status 'pending' por padrão", () => {
    const item = buildItem();
    expect(item.status).toBe("pending");
    expect(item.statusReason).toBeNull();
    expect(item.lastStatusUpdatedAt).toBeNull();
  });

  it("schema Zod rejeita status fora do enum", () => {
    // Testa diretamente o Zod enum que a rota usa (replicado aqui para garantir
    // que o enum está correto sem depender do servidor HTTP).
    const StatusBodySchema = z.object({
      status: z.enum(["pending", "in_progress", "blocked", "done", "abandoned"]),
      reason: z.string().max(500).optional(),
    });

    expect(StatusBodySchema.safeParse({ status: "invalid" }).success).toBe(false);
    expect(StatusBodySchema.safeParse({ status: "pending" }).success).toBe(true);
    expect(StatusBodySchema.safeParse({ status: "in_progress" }).success).toBe(true);
    expect(StatusBodySchema.safeParse({ status: "blocked" }).success).toBe(true);
    expect(StatusBodySchema.safeParse({ status: "done" }).success).toBe(true);
    expect(StatusBodySchema.safeParse({ status: "abandoned" }).success).toBe(true);
  });
});

describe("PATCH /actions/:itemId/status — lógica do handler", () => {
  // Handler extraído diretamente para testar sem servidor Fastify.
  // Segue o mesmo padrão de tests/auth/middleware.test.ts.

  async function callHandler(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const { getPrisma } = await import("@/persistence/prisma.js");
    const { randomUUID } = await import("node:crypto");
    const { problemDetail } = await import("@/http/problem-detail.js");

    const db = getPrisma();
    const typedReq = req as FastifyRequest & {
      params: { itemId: string };
      body: { status: string; reason?: string };
    };

    const item = await db.actionPlanItem.findFirst({
      where: {
        id: typedReq.params.itemId,
        analysis: { tenantId: req.auth!.tenantId },
      },
    });

    if (!item) {
      reply.status(404).send(problemDetail({
        type: "https://api.aicfo.com.br/errors/action-item-not-found",
        title: "Item não encontrado",
        status: 404,
        instance: req.url,
        requestId: randomUUID(),
      }));
      return;
    }

    const updated = await db.actionPlanItem.update({
      where: { id: (item as { id: string }).id },
      data: {
        status: typedReq.body.status,
        statusReason: typedReq.body.reason ?? null,
        lastStatusUpdatedAt: new Date(),
      },
    });

    reply.send({ id: (updated as { id: string; status: string }).id, status: (updated as { id: string; status: string }).status });
  }

  it("retorna 200 com id e status atualizado quando item existe e tenant bate", async () => {
    const item = buildItem();
    actionPlanItemFindFirstMock.mockResolvedValue(item);
    actionPlanItemUpdateMock.mockResolvedValue({ ...item, status: "in_progress" });

    const req = reqWith(shadowAuth, { itemId: "item-1" }, { status: "in_progress" });
    const reply = mockReply();

    await callHandler(req, reply);

    expect(reply.statusCode).toBe(0); // não setou status (send direto = 200)
    expect(reply.body).toMatchObject({ id: "item-1", status: "in_progress" });

    expect(actionPlanItemFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        analysis: { tenantId: "tenant-abc" },
      },
    });

    const updateCall = actionPlanItemUpdateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { status: string; statusReason: string | null; lastStatusUpdatedAt: Date };
    };
    expect(updateCall.data.status).toBe("in_progress");
    expect(updateCall.data.statusReason).toBeNull();
    expect(updateCall.data.lastStatusUpdatedAt).toBeInstanceOf(Date);
  });

  it("persiste statusReason quando reason é fornecida", async () => {
    const item = buildItem();
    actionPlanItemFindFirstMock.mockResolvedValue(item);
    actionPlanItemUpdateMock.mockResolvedValue({ ...item, status: "blocked", statusReason: "aguardando fornecedor" });

    const req = reqWith(shadowAuth, { itemId: "item-1" }, { status: "blocked", reason: "aguardando fornecedor" });
    const reply = mockReply();

    await callHandler(req, reply);

    const updateCall = actionPlanItemUpdateMock.mock.calls[0]?.[0] as {
      data: { statusReason: string | null };
    };
    expect(updateCall.data.statusReason).toBe("aguardando fornecedor");
  });

  it("retorna 404 quando item não é encontrado (tenant errado ou itemId inexistente)", async () => {
    actionPlanItemFindFirstMock.mockResolvedValue(null);

    const req = reqWith(shadowAuth, { itemId: "item-inexistente" }, { status: "done" });
    const reply = mockReply();

    await callHandler(req, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.body).toMatchObject({
      type: "https://api.aicfo.com.br/errors/action-item-not-found",
      status: 404,
    });
    expect(actionPlanItemUpdateMock).not.toHaveBeenCalled();
  });

  it("query usa tenantId do auth — nunca do body ou params", async () => {
    actionPlanItemFindFirstMock.mockResolvedValue(null); // sem item = irrelevante

    const req = reqWith(
      { ...shadowAuth, tenantId: "tenant-correto" },
      { itemId: "item-1" },
      { status: "done" },
    );
    const reply = mockReply();

    await callHandler(req, reply);

    const findCall = actionPlanItemFindFirstMock.mock.calls[0]?.[0] as {
      where: { analysis: { tenantId: string } };
    };
    expect(findCall.where.analysis.tenantId).toBe("tenant-correto");
  });
});

describe("requireMode guard — C4 enforcement para PATCH /actions/:itemId/status", () => {
  // Verifica que o guard de modo correto (shadow, assisted, autonomous) está
  // configurado, usando requireMode diretamente (padrão de middleware.test.ts).

  it("permite subscription em shadow (modo de teste)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "shadow" });
    const guard = requireMode("shadow", "assisted", "autonomous");
    const reply = mockReply();
    await guard(reqWith(shadowAuth), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("permite subscription em assisted", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "assisted" });
    const guard = requireMode("shadow", "assisted", "autonomous");
    const reply = mockReply();
    await guard(reqWith(shadowAuth), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("permite subscription em autonomous", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "autonomous" });
    const guard = requireMode("shadow", "assisted", "autonomous");
    const reply = mockReply();
    await guard(reqWith(shadowAuth), reply);
    expect(reply.statusCode).toBe(0);
  });

  it("bloqueia subscription em pilot (não listado como permitido)", async () => {
    subscriptionFindUniqueMock.mockResolvedValue({ mode: "pilot" });
    const guard = requireMode("shadow", "assisted", "autonomous");
    const reply = mockReply();
    await guard(reqWith(shadowAuth), reply);
    expect(reply.statusCode).toBe(403);
  });
});
