import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// O nó dre-classifier deve: (1) enviar direction "unknown" ao LLM para entries com
// direção inferida; (2) NUNCA alterar a direção (entrada/saída) pela categoria LLM —
// o caixa é determinístico e segue o parsing do extrato. Só marca needs_review
// quando a direção CONFIÁVEL do extrato contradiz uma categoria de alta confiança.

const runChunkedMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/monthly-analysis/agents/chunk-runner.js", () => ({
  runChunkedWithTelemetry: (...args: unknown[]) => runChunkedMock(...args),
}));

vi.mock("@/monthly-analysis/agents/classification.js", () => ({
  applyClarityCaps: (c: unknown) => c,
  runDreClassificationAgentWithTelemetry: vi.fn(),
}));

// Perfil de negócio tem chamada LLM própria — mockado para isolar o nó.
vi.mock("@/classification/business-profile.js", () => ({
  inferBusinessProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/monthly-analysis/graph/instrumentation.js", () => ({
  buildAgentTelemetry: () => ({ costs: [], traces: [] }),
  buildRuleBasedTrace: () => ({ costs: [], traces: [] }),
  NOOP_LLM_RESPONSE: {},
}));

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    ledgerEntry: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  }),
}));

vi.mock("@/observability/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { dreClassifierNode } from "@/monthly-analysis/graph/nodes/dre-classifier.js";

function baseState(overrides: Partial<MonthlyAnalysisState>): MonthlyAnalysisState {
  return {
    analysisId: "analysis-1",
    tenantId: "tenant-1",
    costs: [],
    traces: [],
    errors: [],
    ...overrides,
  };
}

// Descrição genérica de propósito: não casa nenhum termo do pré-classificador
// determinístico (rule-classifier), garantindo que estes testes exercitem o
// caminho do LLM (direção/confirmedCategory/write-back), não a regra.
function normalized(entryId: string, direction: "in" | "out") {
  return {
    entryId,
    date: "2026-04-20",
    description: "Pagamento avulso ref 4521",
    normalizedDescription: "pagamento avulso ref 4521",
    amountCents: 387000,
    direction,
    probableCounterparty: null,
    documentType: "tax" as const,
    features: [],
    noiseFlags: [],
  };
}

function raw(entryId: string, direction: "in" | "out", directionInferred: boolean) {
  return {
    entryId,
    date: "2026-04-20",
    description: "Pagamento avulso ref 4521",
    amountCents: 387000,
    direction,
    directionInferred,
  };
}

beforeEach(() => {
  runChunkedMock.mockReset();
  updateManyMock.mockReset();
  updateManyMock.mockResolvedValue({ count: 1 });
});

describe("monthly-analysis/dre-classifier — direção inferida", () => {
  it("envia direction 'unknown' ao classificador para entries com direção inferida", async () => {
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }],
      response: {},
      latencyMs: 10,
    });

    await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "in", true)],
      normalizedEntries: [normalized("e1", "in")],
    }));

    const inputs = runChunkedMock.mock.calls[0]?.[0] as Array<{ entryId: string; direction: string }>;
    expect(inputs[0]?.direction).toBe("unknown");
  });

  it("mantém a direção original no prompt quando ela é confiável", async () => {
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }],
      response: {},
      latencyMs: 10,
    });

    await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "in", false)],
      normalizedEntries: [normalized("e1", "in")],
    }));

    const inputs = runChunkedMock.mock.calls[0]?.[0] as Array<{ direction: string }>;
    expect(inputs[0]?.direction).toBe("in");
  });

  it("NÃO altera a direção inferida mesmo com categoria contrária (caixa determinístico)", async () => {
    // Antes (#164/#190) a categoria flipava a direção inferida. Agora o caixa é fato
    // do extrato: a direção segue o parsing, a categoria LLM alimenta só o DRE.
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }],
      response: {},
      latencyMs: 10,
    });

    const result = await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "in", true)],
      normalizedEntries: [normalized("e1", "in")],
    }));

    // Nenhum write-back grava `direction` — nem para direção inferida.
    const updatesWithDirection = updateManyMock.mock.calls
      .map((c) => c[0] as { data: Record<string, unknown> })
      .filter((c) => c.data.direction !== undefined);
    expect(updatesWithDirection).toHaveLength(0);

    // A categoria predita É gravada (DRE), mas a direção do estado fica intocada.
    const catUpdate = updateManyMock.mock.calls
      .map((c) => c[0] as { data: Record<string, unknown> })
      .find((c) => c.data.predictedCategory === "simples_nacional");
    expect(catUpdate).toBeDefined();
    expect(result.normalizedEntries === undefined || result.normalizedEntries[0]?.direction === "in").toBe(true);
  });

  it("NÃO flipa quando a direção é confiável, mesmo com categoria contrária", async () => {
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }],
      response: {},
      latencyMs: 10,
    });

    const result = await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "in", false)],
      normalizedEntries: [normalized("e1", "in")],
    }));

    const updatesWithDirection = updateManyMock.mock.calls
      .map((c) => c[0] as { data: Record<string, unknown> })
      .filter((c) => c.data.direction !== undefined);
    expect(updatesWithDirection).toHaveLength(0);
    expect(result.normalizedEntries === undefined || result.normalizedEntries[0]?.direction === "in").toBe(true);
  });
});

describe("monthly-analysis/dre-classifier — categoria confirmada na origem (paridade shouldSkipClassification)", () => {
  it("entries com confirmedCategory são puladas do LLM e do write-back", async () => {
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e2", category: "despesas_administrativas", confidence: 0.9 }],
      response: {},
      latencyMs: 10,
    });

    await dreClassifierNode(baseState({
      rawEntries: [
        { ...raw("e1", "out", false), confirmedCategory: "custo_servicos" },
        raw("e2", "out", false),
      ],
      normalizedEntries: [normalized("e1", "out"), normalized("e2", "out")],
    }));

    // Só e2 vai ao LLM.
    const inputs = runChunkedMock.mock.calls[0]?.[0] as Array<{ entryId: string }>;
    expect(inputs.map((i) => i.entryId)).toEqual(["e2"]);

    // Write-back não toca a entry confirmada (não sobrescreve predictedCategory dela).
    const touchedIds = updateManyMock.mock.calls
      .map((c) => (c[0] as { where: { id: string } }).where.id);
    expect(touchedIds).not.toContain("e1");
  });

  it("todas confirmadas → nenhuma chamada LLM (skip total, como o BullMQ)", async () => {
    // Sem item ambíguo (tudo confirmado na origem), o nó nem invoca o chunk-runner:
    // pula o LLM por completo (zero custo/latência), emitindo só o trace rule-based.
    runChunkedMock.mockResolvedValue({ data: [], response: {}, latencyMs: 0 });

    await dreClassifierNode(baseState({
      rawEntries: [
        { ...raw("e1", "out", false), confirmedCategory: "custo_servicos" },
        { ...raw("e2", "in", false), confirmedCategory: "receita_bruta" },
      ],
      normalizedEntries: [normalized("e1", "out"), normalized("e2", "in")],
    }));

    expect(runChunkedMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("aggregate-dre usa a categoria confirmada com precedência sobre a predita", async () => {
    const { aggregateDreNode } = await import("@/monthly-analysis/graph/nodes/aggregate-dre.js");

    const result = await aggregateDreNode(baseState({
      rawEntries: [
        { ...raw("e1", "in", false), confirmedCategory: "receita_bruta" },
        raw("e2", "out", false),
      ],
      normalizedEntries: [normalized("e1", "in"), normalized("e2", "out")],
      // Predição contraditória para e1: a confirmada deve vencer no DRE.
      classifiedEntries: [
        { entryId: "e1", category: "outras_despesas", confidence: 0.9 },
        { entryId: "e2", category: "despesas_administrativas", confidence: 0.9 },
      ],
    }));

    // e1 (R$3.870,00, confirmada receita_bruta) entra como receita, não despesa.
    expect(result.dre?.receitaBruta).toBe(387000);
  });
});

describe("monthly-analysis/dre-classifier — segurança C8 (write-back escopado)", () => {
  // Cobertura herdada do classifier.test.ts legado (removido com a cadeia BullMQ):
  // um entryId alucinado pelo LLM não pode tocar lançamento de outra análise/tenant.
  it("todo updateMany do flywheel é escopado por id+tenantId+analysisId (id forjado vira no-op)", async () => {
    runChunkedMock.mockResolvedValue({
      data: [
        { entryId: "e1", category: "simples_nacional", confidence: 0.95 },
        { entryId: "FORJADO-XXX", category: "receita_bruta", confidence: 0.99 }, // alucinado
      ],
      response: {},
      latencyMs: 10,
    });

    await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "out", false)],
      normalizedEntries: [normalized("e1", "out")],
    }));

    // O id forjado também vai ao updateMany, mas o where escopado garante que só
    // pode casar dentro DESTA análise/tenant — em outro escopo é no-op (count 0).
    expect(updateManyMock).toHaveBeenCalledTimes(2);
    for (const call of updateManyMock.mock.calls) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where.tenantId).toBe("tenant-1");
      expect(where.analysisId).toBe("analysis-1");
      expect(where.id).toBeDefined();
    }
  });
});
