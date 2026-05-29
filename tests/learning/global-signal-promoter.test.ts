import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkAndPromoteToGlobal,
  retireGlobalSignalsForTenant,
  MIN_GLOBAL_CONTRIBUTORS,
} from "@/learning/global-signal-promoter.js";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    tenantMemoryItem: {
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
    },
    globalSignal: {
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}));

function makeFact(tenantId: string, description: string, category: string, globalSignalId: string | null = null) {
  return {
    id: `item-${tenantId}`,
    tenantId,
    content: { description, category, source: "client_correction" },
    contributesToGlobal: globalSignalId !== null,
    globalSignalId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: "signal-1" });
  mockUpdate.mockResolvedValue({});
  mockUpdateMany.mockResolvedValue({ count: 0 });
});

// ── checkAndPromoteToGlobal ──────────────────────────────────────────────────

describe("checkAndPromoteToGlobal", () => {
  it("não promove quando há menos de 5 tenants distintos", async () => {
    const facts = ["t1", "t2", "t3", "t4"].map((id) => makeFact(id, "FULANO SILVA", "prolabore"));
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t5", "varejo", "FULANO SILVA", "prolabore");

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("promove quando exatamente 5 tenants distintos convergem", async () => {
    const facts = ["t1", "t2", "t3", "t4", "t5"].map((id) => makeFact(id, "FULANO SILVA", "prolabore"));
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t5", "varejo", "FULANO SILVA", "prolabore");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: "varejo",
          kind: "fact",
          contributorCount: 5,
          content: { description: "fulano silva", category: "prolabore" },
        }),
      }),
    );
  });

  it("normaliza description (lowercase + trim) antes de comparar", async () => {
    const facts = [
      makeFact("t1", "FULANO SILVA", "prolabore"),
      makeFact("t2", "fulano silva", "prolabore"),
      makeFact("t3", "  Fulano Silva  ", "prolabore"),
      makeFact("t4", "FULANO SILVA", "prolabore"),
      makeFact("t5", "fulano silva", "prolabore"),
    ];
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t1", "varejo", "FULANO SILVA", "prolabore");

    expect(mockCreate).toHaveBeenCalled();
  });

  it("não confunde facts de categorias diferentes", async () => {
    // 4 com prolabore + 3 com despesas_pessoal — nem um grupo tem 5
    const facts = [
      ...["t1", "t2", "t3", "t4"].map((id) => makeFact(id, "MARIA LIMA", "prolabore")),
      ...["t5", "t6", "t7"].map((id) => makeFact(id, "MARIA LIMA", "despesas_pessoal")),
    ];
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t8", "varejo", "MARIA LIMA", "prolabore");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("atualiza GlobalSignal existente em vez de criar novo", async () => {
    const facts = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => {
      // t1-t5 já têm globalSignalId, t6 não
      const signalId = id !== "t6" ? "signal-existing" : null;
      return makeFact(id, "FORNECEDOR ABC", "servicos_terceiros", signalId);
    });
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t6", "servicos-b2b", "FORNECEDOR ABC", "servicos_terceiros");

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "signal-existing" },
        data: { contributorCount: 6 },
      }),
    );
  });

  it("marca os TenantMemoryItems ainda não vinculados como contributesToGlobal", async () => {
    const facts = [
      ...["t1", "t2", "t3", "t4"].map((id) => makeFact(id, "LOJA XYZ", "receita_bruta", "signal-1")),
      makeFact("t5", "LOJA XYZ", "receita_bruta", null), // t5 ainda não vinculado
    ];
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t5", "varejo", "LOJA XYZ", "receita_bruta");

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["item-t5"] } },
        data: { contributesToGlobal: true, globalSignalId: "signal-1" },
      }),
    );
  });

  it("não chama updateMany se todos os facts já estão vinculados ao sinal correto", async () => {
    const facts = ["t1", "t2", "t3", "t4", "t5"].map((id) =>
      makeFact(id, "EMPRESA ABC", "consultoria", "signal-99"),
    );
    mockFindMany.mockResolvedValue(facts);

    await checkAndPromoteToGlobal("t5", "varejo", "EMPRESA ABC", "consultoria");

    // Todos já têm globalSignalId "signal-99" — nenhum item para vincular
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

// ── retireGlobalSignalsForTenant ──────────────────────────────────────────────

describe("retireGlobalSignalsForTenant", () => {
  it("retira GlobalSignal quando contribuintes restantes < k=5", async () => {
    mockFindMany.mockResolvedValue([{ globalSignalId: "signal-1" }, { globalSignalId: "signal-2" }]);
    mockCount
      .mockResolvedValueOnce(4) // signal-1: 4 restantes — abaixo do limiar
      .mockResolvedValueOnce(6); // signal-2: 6 restantes — ok

    await retireGlobalSignalsForTenant("tenant-saindo");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "signal-1" },
        data: expect.objectContaining({ retiredAt: expect.any(Date), contributorCount: 4 }),
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "signal-2" },
        data: { contributorCount: 6 },
      }),
    );
  });

  it("não chama update quando tenant não contribui para nenhum GlobalSignal", async () => {
    mockFindMany.mockResolvedValue([]);

    await retireGlobalSignalsForTenant("tenant-novo");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it(`retira quando restantes são exatamente ${MIN_GLOBAL_CONTRIBUTORS - 1}`, async () => {
    mockFindMany.mockResolvedValue([{ globalSignalId: "sig-x" }]);
    mockCount.mockResolvedValue(MIN_GLOBAL_CONTRIBUTORS - 1);

    await retireGlobalSignalsForTenant("t-leaving");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ retiredAt: expect.any(Date) }),
      }),
    );
  });

  it(`mantém sinal quando restantes são exatamente ${MIN_GLOBAL_CONTRIBUTORS}`, async () => {
    mockFindMany.mockResolvedValue([{ globalSignalId: "sig-y" }]);
    mockCount.mockResolvedValue(MIN_GLOBAL_CONTRIBUTORS);

    await retireGlobalSignalsForTenant("t-leaving");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { contributorCount: MIN_GLOBAL_CONTRIBUTORS },
      }),
    );
    // Não deve ter retiredAt
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ retiredAt: expect.any(Date) }),
      }),
    );
  });

  it("deduplica signalIds — não processa o mesmo sinal duas vezes", async () => {
    // Dois items apontam para o mesmo globalSignalId
    mockFindMany.mockResolvedValue([
      { globalSignalId: "signal-dup" },
      { globalSignalId: "signal-dup" },
    ]);
    mockCount.mockResolvedValue(6);

    await retireGlobalSignalsForTenant("t-dup");

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
