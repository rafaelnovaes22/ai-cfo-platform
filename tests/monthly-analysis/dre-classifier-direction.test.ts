import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// O nó dre-classifier deve: (1) enviar direction "unknown" ao LLM para entries com
// direção inferida; (2) corrigir a direção (banco + estado) quando a categoria
// prevista tem natureza contrária. Regressão da planilha CID & CID — arquivo sem
// coluna Tipo preenchida e sem sinais fazia toda despesa virar receita.

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

function normalized(entryId: string, direction: "in" | "out") {
  return {
    entryId,
    date: "2026-04-20",
    description: "DAS Simples Nacional",
    normalizedDescription: "das simples nacional",
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
    description: "DAS Simples Nacional",
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

  it("flipa direção no banco e no estado quando categoria de despesa contradiz credit inferido", async () => {
    runChunkedMock.mockResolvedValue({
      data: [{ entryId: "e1", category: "simples_nacional", confidence: 0.95 }],
      response: {},
      latencyMs: 10,
    });

    const result = await dreClassifierNode(baseState({
      rawEntries: [raw("e1", "in", true)],
      normalizedEntries: [normalized("e1", "in")],
    }));

    // Write-back no banco com direção corrigida (escopado a tenant+analysis).
    const updateWithDirection = updateManyMock.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> })
      .find((c) => c.data.direction !== undefined);
    expect(updateWithDirection).toBeDefined();
    expect(updateWithDirection?.data.direction).toBe("debit");
    expect(updateWithDirection?.where).toMatchObject({
      id: "e1",
      tenantId: "tenant-1",
      analysisId: "analysis-1",
    });

    // Estado corrigido para os nós downstream (financial-diagnosis, cashflow-risk).
    expect(result.normalizedEntries?.[0]?.direction).toBe("out");
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
    // runChunkedWithTelemetry real curto-circuita lista vazia sem chamar runFn;
    // aqui validamos que o nó nem invoca o chunk-runner com itens.
    runChunkedMock.mockResolvedValue({ data: [], response: {}, latencyMs: 0 });

    await dreClassifierNode(baseState({
      rawEntries: [
        { ...raw("e1", "out", false), confirmedCategory: "custo_servicos" },
        { ...raw("e2", "in", false), confirmedCategory: "receita_bruta" },
      ],
      normalizedEntries: [normalized("e1", "out"), normalized("e2", "in")],
    }));

    const inputs = runChunkedMock.mock.calls[0]?.[0] as unknown[];
    expect(inputs).toHaveLength(0);
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
