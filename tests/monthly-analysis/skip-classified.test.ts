import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do chunk-runner: captura os itens enviados ao LLM e devolve normalizados
// ecoando o input (sem chamar modelo). buildPassthroughNormalized e resolvedEntryIds
// permanecem reais — são o que estamos testando.
const runChunkedMock = vi.fn();
vi.mock("@/monthly-analysis/agents/chunk-runner.js", () => ({
  runChunkedWithTelemetry: (...args: unknown[]) => runChunkedMock(...args),
}));
vi.mock("@/monthly-analysis/graph/instrumentation.js", () => ({
  buildAgentTelemetry: () => ({ costs: [], traces: [] }),
  buildRuleBasedTrace: () => ({ costs: [], traces: [] }),
  NOOP_LLM_RESPONSE: { content: "", provider: "noop", model: "noop", inputTokens: 0, outputTokens: 0, costCents: 0 },
}));

const { normalizeNode } = await import("@/monthly-analysis/graph/nodes/normalize.js");
const { clarityJudgeNode } = await import("@/monthly-analysis/graph/nodes/clarity-judge.js");
const { isResolvedEntry, resolvedEntryIds } = await import("@/monthly-analysis/graph/resolved-entries.js");
const { buildPassthroughNormalized } = await import("@/monthly-analysis/agents/normalization.js");

type Raw = {
  entryId: string; date: string; description: string; amountCents: number;
  direction: "in" | "out"; confirmedCategory?: string | null; predictedCategory?: string | null;
  classificationConfidence?: number | null;
};

function raw(over: Partial<Raw> = {}): Raw {
  return { entryId: "e1", date: "2026-01-31", description: "PAYPAL", amountCents: 100000, direction: "in", ...over };
}

function echoNormalized(items: Raw[]) {
  return {
    data: items.map((e) => ({
      entryId: e.entryId, date: e.date, description: e.description, normalizedDescription: e.description,
      amountCents: e.amountCents, direction: e.direction, documentType: "unknown", features: [], noiseFlags: [],
    })),
    response: { content: "", provider: "noop", model: "noop", inputTokens: 0, outputTokens: 0, costCents: 0 },
    latencyMs: 0,
  };
}

describe("resolved-entries", () => {
  it("confirmado é resolvido", () => {
    expect(isResolvedEntry({ confirmedCategory: "receita_bruta", predictedCategory: null })).toBe(true);
  });
  it("predito (reuso ligado) é resolvido", () => {
    expect(isResolvedEntry({ confirmedCategory: null, predictedCategory: "custo_servicos" }, true)).toBe(true);
  });
  it("predito NÃO é resolvido com reuso desligado", () => {
    expect(isResolvedEntry({ confirmedCategory: null, predictedCategory: "custo_servicos" }, false)).toBe(false);
  });
  it("sem categoria não é resolvido", () => {
    expect(isResolvedEntry({ confirmedCategory: null, predictedCategory: null }, true)).toBe(false);
  });
  it("resolvedEntryIds reúne confirmados e preditos", () => {
    const ids = resolvedEntryIds([
      raw({ entryId: "a", confirmedCategory: "receita_bruta" }),
      raw({ entryId: "b", predictedCategory: "custo_servicos" }),
      raw({ entryId: "c" }),
    ] as never, true);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("buildPassthroughNormalized", () => {
  it("preserva campos imutáveis e normaliza a descrição (zero-token)", () => {
    const n = buildPassthroughNormalized(raw({ description: "  PAYPAL   MARCO  " }) as never);
    expect(n.entryId).toBe("e1");
    expect(n.amountCents).toBe(100000);
    expect(n.direction).toBe("in");
    expect(n.documentType).toBe("unknown");
    expect(n.normalizedDescription.length).toBeGreaterThan(0);
  });
});

describe("normalizeNode — curto-circuito de resolvidos", () => {
  beforeEach(() => { runChunkedMock.mockReset(); });

  it("envia ao LLM só os não-resolvidos e preserva 1 saída por lançamento na ordem", async () => {
    runChunkedMock.mockImplementation(async (items: Raw[]) => echoNormalized(items));
    const rawEntries = [
      raw({ entryId: "a", confirmedCategory: "receita_bruta" }),   // resolvido (passthrough)
      raw({ entryId: "b" }),                                        // novo (LLM)
      raw({ entryId: "c", predictedCategory: "custo_servicos" }),  // resolvido (passthrough)
      raw({ entryId: "d" }),                                        // novo (LLM)
    ];
    const out = await normalizeNode({ rawEntries, tenantId: "t1" } as never);

    // chunk-runner recebeu só b e d
    const sent = runChunkedMock.mock.calls[0]![0] as Raw[];
    expect(sent.map((e) => e.entryId)).toEqual(["b", "d"]);
    // saída tem 1 por lançamento, na ordem original
    expect(out.normalizedEntries!.map((e) => e.entryId)).toEqual(["a", "b", "c", "d"]);
  });

  it("tudo resolvido → não chama o LLM (chunk-runner recebe lista vazia)", async () => {
    runChunkedMock.mockImplementation(async (items: Raw[]) => echoNormalized(items));
    const rawEntries = [
      raw({ entryId: "a", confirmedCategory: "receita_bruta" }),
      raw({ entryId: "b", predictedCategory: "custo_servicos" }),
    ];
    const out = await normalizeNode({ rawEntries, tenantId: "t1" } as never);
    expect((runChunkedMock.mock.calls[0]![0] as Raw[]).length).toBe(0);
    expect(out.normalizedEntries!.map((e) => e.entryId)).toEqual(["a", "b"]);
  });
});

describe("clarityJudgeNode — pula resolvidos", () => {
  beforeEach(() => { runChunkedMock.mockReset(); });

  it("manda ao clarity só os não-resolvidos", async () => {
    runChunkedMock.mockImplementation(async () => ({
      data: [], response: { content: "", provider: "noop", model: "noop", inputTokens: 0, outputTokens: 0, costCents: 0 }, latencyMs: 0,
    }));
    const rawEntries = [
      raw({ entryId: "a", confirmedCategory: "receita_bruta" }),
      raw({ entryId: "b" }),
      raw({ entryId: "c", predictedCategory: "custo_servicos" }),
    ];
    const normalizedEntries = rawEntries.map((e) => buildPassthroughNormalized(e as never));
    await clarityJudgeNode({ rawEntries, normalizedEntries, tenantId: "t1" } as never);

    const sent = runChunkedMock.mock.calls[0]![0] as { entryId: string }[];
    expect(sent.map((e) => e.entryId)).toEqual(["b"]);
  });
});
