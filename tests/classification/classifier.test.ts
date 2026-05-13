import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks: classificar usa db (prisma), callLlm e enqueueDreNarrative.
// Substituímos tudo para isolar o teste no comportamento de segurança.

const ledgerFindManyMock = vi.fn();
const ledgerUpdateManyMock = vi.fn();
const enqueueDreNarrativeMock = vi.fn();
const callLlmMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    ledgerEntry: {
      findMany: ledgerFindManyMock,
      updateMany: ledgerUpdateManyMock,
    },
  }),
}));

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

vi.mock("@/queue/index.js", () => ({
  enqueueDreNarrative: (...args: unknown[]) => enqueueDreNarrativeMock(...args),
}));

import { classifyAnalysis } from "@/classification/classifier.js";

beforeEach(() => {
  ledgerFindManyMock.mockReset();
  ledgerUpdateManyMock.mockReset();
  enqueueDreNarrativeMock.mockReset();
  callLlmMock.mockReset();
  ledgerUpdateManyMock.mockResolvedValue({ count: 1 });
});

describe("classification/classifier — segurança C8", () => {
  it("descarta entryId fora do batch (anti-leak via LLM)", async () => {
    const batchEntries = [
      { id: "real-1", date: new Date("2026-04-01"), description: "Pix",   amountCents: 100, direction: "credit" },
      { id: "real-2", date: new Date("2026-04-02"), description: "Boleto", amountCents: 200, direction: "debit"  },
    ];
    ledgerFindManyMock.mockResolvedValue(batchEntries);

    // LLM "alucina" um ID alheio que NÃO está no batch.
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([
        { entryId: "real-1",       category: "receita_bruta",   confidence: 0.9 },
        { entryId: "FORJADO-XXX",  category: "receita_bruta",   confidence: 0.99 }, // alheio!
        { entryId: "real-2",       category: "outras_despesas", confidence: 0.85 },
      ]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    // updateMany foi chamado apenas para IDs do batch — 2x, nunca para FORJADO-XXX.
    expect(ledgerUpdateManyMock).toHaveBeenCalledTimes(2);
    const calledIds = ledgerUpdateManyMock.mock.calls.map((c) => (c[0] as { where: { id: string } }).where.id);
    expect(calledIds).toEqual(expect.arrayContaining(["real-1", "real-2"]));
    expect(calledIds).not.toContain("FORJADO-XXX");
  });

  it("update é sempre restringido por analysisId E tenantId no where", async () => {
    ledgerFindManyMock.mockResolvedValue([
      { id: "e1", date: new Date("2026-04-01"), description: "X", amountCents: 50, direction: "credit" },
    ]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.95 }]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-XYZ", "tenant-XYZ");

    expect(ledgerUpdateManyMock).toHaveBeenCalledTimes(1);
    const arg = ledgerUpdateManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "e1",
      analysisId: "analysis-XYZ",
      tenantId: "tenant-XYZ",
    });
  });

  it("LLM error: usa updateMany para marcar batch como needs_review", async () => {
    ledgerFindManyMock.mockResolvedValue([
      { id: "e1", date: new Date("2026-04-01"), description: "X", amountCents: 100, direction: "credit" },
    ]);
    callLlmMock.mockRejectedValue(new Error("LLM down"));

    // Precisamos do updateMany sobre os IDs do batch quando o LLM falha — vamos passar
    // um db.ledgerEntry.updateMany separado do branch principal.
    // Como o classifier original chama db.ledgerEntry.updateMany para o fallback de needs_review,
    // o mesmo mock funciona.

    await classifyAnalysis("analysis-A", "tenant-A");

    // Foi chamado o updateMany no fallback (catch).
    expect(ledgerUpdateManyMock).toHaveBeenCalled();
    const call = ledgerUpdateManyMock.mock.calls[0]?.[0] as { where: { id: { in: string[] } }; data: { predictedCategory: string } };
    expect(call.where.id.in).toEqual(["e1"]);
    expect(call.data.predictedCategory).toBe("nao_classificado");
  });

  it("não enfileira dre-narrative se findMany retorna vazio", async () => {
    ledgerFindManyMock.mockResolvedValue([]);
    await classifyAnalysis("analysis-vazia", "tenant-1");
    expect(callLlmMock).not.toHaveBeenCalled();
    expect(enqueueDreNarrativeMock).not.toHaveBeenCalled();
  });
});
