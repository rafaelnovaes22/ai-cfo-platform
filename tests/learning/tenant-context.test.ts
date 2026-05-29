import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Prisma mocks ---
const findManyMemoryMock = vi.fn();
const findManyGlobalMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    tenantMemoryItem: {
      findMany: (...args: unknown[]) => findManyMemoryMock(...args),
    },
    globalSignal: {
      findMany: (...args: unknown[]) => findManyGlobalMock(...args),
    },
  }),
}));

import { buildTenantContext } from "@/learning/tenant-context.js";

beforeEach(() => {
  findManyMemoryMock.mockReset();
  findManyGlobalMock.mockReset();
  findManyMemoryMock.mockResolvedValue([]);
  findManyGlobalMock.mockResolvedValue([]);
});

describe("buildTenantContext — estrutura vazia", () => {
  it("retorna arrays vazios quando o tenant não tem memória nem sinais globais", async () => {
    const ctx = await buildTenantContext("tenant-1", "geral");

    expect(ctx.facts).toEqual([]);
    expect(ctx.preferences).toEqual([]);
    expect(ctx.patterns).toEqual([]);
    expect(ctx.globalSignals).toEqual([]);
  });

  it("classifica corretamente itens por kind", async () => {
    findManyMemoryMock.mockResolvedValueOnce([
      { kind: "fact", content: { label: "receita estável" }, confidence: 0.9 },
      { kind: "preference", content: { toneOfVoice: "informal" }, confidence: 1.0 },
      { kind: "pattern", content: { seasonality: "Q4_high" }, confidence: 0.75 },
      { kind: "interpretation", content: { note: "crescimento sustentado" }, confidence: 0.8 },
    ]);

    const ctx = await buildTenantContext("tenant-1", "saas");

    expect(ctx.facts).toHaveLength(1);
    expect(ctx.facts[0]).toEqual({ content: { label: "receita estável" }, confidence: 0.9 });

    expect(ctx.preferences).toHaveLength(1);
    expect(ctx.preferences[0]).toEqual({ content: { toneOfVoice: "informal" } });

    expect(ctx.patterns).toHaveLength(1);
    expect(ctx.patterns[0]).toEqual({ content: { seasonality: "Q4_high" }, confidence: 0.75 });

    // "interpretation" não é mapeado para nenhuma categoria exposta
    expect(ctx.facts.length + ctx.preferences.length + ctx.patterns.length).toBe(3);
  });
});

describe("buildTenantContext — filtro dismissedAt", () => {
  it("exclui items com dismissedAt não-nulo via query (query correta passada ao Prisma)", async () => {
    await buildTenantContext("tenant-2", "varejo");

    expect(findManyMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-2",
          dismissedAt: null,
        }),
      }),
    );
  });
});

describe("buildTenantContext — filtro GlobalSignal contributorCount", () => {
  it("exclui sinais globais com contributorCount < 5 via query", async () => {
    await buildTenantContext("tenant-3", "servicos-b2b");

    expect(findManyGlobalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          segment: "servicos-b2b",
          retiredAt: null,
          contributorCount: { gte: 5 },
        }),
      }),
    );
  });

  it("popula globalSignals com items que passam pelo filtro", async () => {
    findManyGlobalMock.mockResolvedValueOnce([
      { content: { benchmark: "margem_media_saas", value: 0.65 } },
      { content: { benchmark: "ticket_medio", value: 1200 } },
    ]);

    const ctx = await buildTenantContext("tenant-3", "saas");

    expect(ctx.globalSignals).toHaveLength(2);
    expect(ctx.globalSignals[0]).toEqual({ content: { benchmark: "margem_media_saas", value: 0.65 } });
  });
});

describe("buildTenantContext — limite de 50 items", () => {
  it("passa take: 50 na query de TenantMemoryItem", async () => {
    await buildTenantContext("tenant-4", "geral");

    expect(findManyMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });
});

describe("buildTenantContext — filtro expiresAt", () => {
  it("inclui items com expiresAt null ou expiresAt no futuro via OR", async () => {
    await buildTenantContext("tenant-5", "industria-leve");

    const callArgs = findManyMemoryMock.mock.calls[0][0] as {
      where: { OR?: unknown[] };
    };

    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(2);
  });
});
