import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks: classificar usa db (prisma), callLlm e enqueueDreNarrative.
// Substituímos tudo para isolar o teste no comportamento de segurança.

const ledgerFindManyMock = vi.fn();
const ledgerUpdateManyMock = vi.fn();
const tenantFindUniqueMock = vi.fn();
const transactionMock = vi.fn();
const enqueueDreNarrativeMock = vi.fn();
const callLlmMock = vi.fn();
const inferBusinessProfileMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    ledgerEntry: {
      findMany: ledgerFindManyMock,
      updateMany: ledgerUpdateManyMock,
    },
    tenant: {
      findUnique: tenantFindUniqueMock,
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  }),
}));

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

vi.mock("@/queue/index.js", () => ({
  enqueueDreNarrative: (...args: unknown[]) => enqueueDreNarrativeMock(...args),
}));

// Perfil do negócio é inferido por 1 chamada LLM própria; mockado aqui para isolar
// os testes do classificador (contagem de batches, paralelismo). Tem teste próprio.
vi.mock("@/classification/business-profile.js", () => ({
  inferBusinessProfile: (...args: unknown[]) => inferBusinessProfileMock(...args),
}));

import { classifyAnalysis } from "@/classification/classifier.js";

beforeEach(() => {
  ledgerFindManyMock.mockReset();
  ledgerUpdateManyMock.mockReset();
  tenantFindUniqueMock.mockReset();
  transactionMock.mockReset();
  enqueueDreNarrativeMock.mockReset();
  callLlmMock.mockReset();
  inferBusinessProfileMock.mockReset();
  inferBusinessProfileMock.mockResolvedValue(undefined);
  ledgerUpdateManyMock.mockResolvedValue({ count: 1 });
  tenantFindUniqueMock.mockResolvedValue({ industrySegment: null });
  // $transaction(array de PrismaPromises) → resolve todas (batch transaction)
  transactionMock.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
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

// Monta a resposta do LLM ecoando os entryIds presentes no userPrompt do batch.
function llmReplyFromPrompt(userPrompt: string, category = "receita_bruta") {
  const payload = JSON.parse(userPrompt.slice(userPrompt.indexOf("["))) as Array<{ entryId: string }>;
  return {
    content: JSON.stringify(payload.map((p) => ({ entryId: p.entryId, category, confidence: 0.9 }))),
    costCents: 1,
    traceId: null,
  };
}

function manyEntries(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    date: new Date("2026-04-01"),
    description: `Lançamento ${i}`,
    amountCents: 100,
    direction: "credit",
    directionInferred: false,
  }));
}

describe("classification/classifier — batches paralelos (perf, espelha PR #120 no caminho BullMQ)", () => {
  it("processa os batches LLM em paralelo, não em série", async () => {
    ledgerFindManyMock.mockResolvedValue(manyEntries(50)); // 3 batches de 20/20/10

    let inFlight = 0;
    let maxInFlight = 0;
    callLlmMock.mockImplementation(async (req: { userPrompt: string }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return llmReplyFromPrompt(req.userPrompt);
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    expect(callLlmMock).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBeGreaterThan(1); // sobreposição = paralelismo real
    expect(enqueueDreNarrativeMock).toHaveBeenCalledTimes(1); // barreira preservada
  });

  it("falha de LLM em um lote degrada só aquele lote; os demais classificam normalmente", async () => {
    ledgerFindManyMock.mockResolvedValue(manyEntries(50)); // 3 batches

    callLlmMock.mockImplementation(async (req: { userPrompt: string }) => {
      const payload = JSON.parse(req.userPrompt.slice(req.userPrompt.indexOf("["))) as Array<{ entryId: string }>;
      if (payload.some((p) => p.entryId === "e0")) throw new Error("LLM down");
      return llmReplyFromPrompt(req.userPrompt);
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    // Lote que falhou: marcado nao_classificado/needs_review em bloco (catch path).
    const catchCall = ledgerUpdateManyMock.mock.calls
      .map((c) => c[0] as { where: { id?: { in?: string[] } }; data: Record<string, unknown> })
      .find((c) => Array.isArray(c.where.id?.in));
    expect(catchCall?.where.id?.in).toContain("e0");
    expect(catchCall?.data.predictedCategory).toBe("nao_classificado");

    // Lotes saudáveis: 2 transações de updates (uma por batch ok).
    expect(transactionMock).toHaveBeenCalledTimes(2);
    // Pipeline continua: dre-narrative enfileirado mesmo com degradação parcial.
    expect(enqueueDreNarrativeMock).toHaveBeenCalledTimes(1);
  });

  it("agrupa os updates de cada batch numa transação única (R7), mantendo o where composto C8", async () => {
    ledgerFindManyMock.mockResolvedValue(manyEntries(3)); // 1 batch
    callLlmMock.mockImplementation(async (req: { userPrompt: string }) => llmReplyFromPrompt(req.userPrompt));

    await classifyAnalysis("analysis-XYZ", "tenant-XYZ");

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const ops = transactionMock.mock.calls[0]?.[0] as unknown[];
    expect(ops).toHaveLength(3);
    // Cada update continua escopado por id+analysisId+tenantId (defesa C8).
    for (const call of ledgerUpdateManyMock.mock.calls) {
      const arg = call[0] as { where: Record<string, unknown> };
      expect(arg.where).toMatchObject({ analysisId: "analysis-XYZ", tenantId: "tenant-XYZ" });
    }
  });
});

describe("classification/classifier — correção de direção inferida (regressão CID & CID)", () => {
  const inferredEntry = (id: string, direction: "credit" | "debit", directionInferred: boolean) => ({
    id,
    date: new Date("2026-04-20"),
    description: `Lançamento ${id}`,
    amountCents: 387000,
    direction,
    directionInferred,
  });

  it("envia direction 'unknown' ao LLM quando a direção foi inferida", async () => {
    ledgerFindManyMock.mockResolvedValue([
      inferredEntry("e-inf", "credit", true),
      inferredEntry("e-ok", "credit", false),
    ]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([
        { entryId: "e-inf", category: "simples_nacional", confidence: 0.95 },
        { entryId: "e-ok", category: "receita_bruta", confidence: 0.9 },
      ]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    const llmArg = callLlmMock.mock.calls[0]?.[0] as { userPrompt: string };
    const payload = JSON.parse(llmArg.userPrompt.slice(llmArg.userPrompt.indexOf("["))) as
      Array<{ entryId: string; direction: string }>;
    expect(payload.find((p) => p.entryId === "e-inf")?.direction).toBe("unknown");
    expect(payload.find((p) => p.entryId === "e-ok")?.direction).toBe("credit");
  });

  it("flipa direção quando inferida E categoria tem natureza contrária (despesa marcada como credit)", async () => {
    ledgerFindManyMock.mockResolvedValue([inferredEntry("e1", "credit", true)]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    const update = ledgerUpdateManyMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).toMatchObject({ predictedCategory: "simples_nacional", direction: "debit" });
  });

  it("NÃO flipa direção quando ela veio confiável do arquivo (extrato bancário)", async () => {
    // Direção é fato do extrato; categoria do LLM pode estar errada — direção vence.
    ledgerFindManyMock.mockResolvedValue([inferredEntry("e1", "credit", false)]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    const update = ledgerUpdateManyMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).not.toHaveProperty("direction");
  });

  it("NÃO flipa quando a categoria já concorda com a direção inferida", async () => {
    ledgerFindManyMock.mockResolvedValue([inferredEntry("e1", "credit", true)]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.9 }]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    const update = ledgerUpdateManyMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).not.toHaveProperty("direction");
  });

  it("injeta o segment do tenant no prompt (paridade com o nó LangGraph)", async () => {
    tenantFindUniqueMock.mockResolvedValue({ industrySegment: "agência de jornalismo" });
    ledgerFindManyMock.mockResolvedValue([inferredEntry("e1", "credit", true)]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.9 }]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    const llmArg = callLlmMock.mock.calls[0]?.[0] as { userPrompt: string };
    expect(llmArg.userPrompt).toContain("Segmento da empresa: agência de jornalismo");
  });

  it("NÃO flipa em categoria de natureza neutra (nao_classificado / transferencia_interna)", async () => {
    ledgerFindManyMock.mockResolvedValue([
      inferredEntry("e1", "credit", true),
      inferredEntry("e2", "credit", true),
    ]);
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([
        { entryId: "e1", category: "nao_classificado", confidence: 0.45 },
        { entryId: "e2", category: "transferencia_interna", confidence: 0.8 },
      ]),
      costCents: 1,
      traceId: null,
    });

    await classifyAnalysis("analysis-A", "tenant-A");

    for (const call of ledgerUpdateManyMock.mock.calls) {
      const update = call[0] as { data: Record<string, unknown> };
      expect(update.data).not.toHaveProperty("direction");
    }
  });
});
