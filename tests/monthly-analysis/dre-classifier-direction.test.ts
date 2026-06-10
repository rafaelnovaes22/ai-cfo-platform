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
