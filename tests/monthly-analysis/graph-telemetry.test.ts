import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueAnalysisMock = vi.fn();
const findManyAnalysesMock = vi.fn();
const findManyLedgerMock = vi.fn();
const ledgerUpdateManyMock = vi.fn().mockResolvedValue({ count: 0 });
const findManyMemoryMock = vi.fn().mockResolvedValue([]);
const findManyGlobalMock = vi.fn().mockResolvedValue([]);

const finalizeUpdateMock = vi.fn().mockResolvedValue({});
const finalizeTxMock = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
  return fn({
    monthlyAnalysis: { update: finalizeUpdateMock },
    narrativeCard: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    actionPlanItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  });
});

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueAnalysisMock(...args),
      findMany: (...args: unknown[]) => findManyAnalysesMock(...args),
      update: vi.fn().mockResolvedValue({}),
    },
    ledgerEntry: {
      findMany: (...args: unknown[]) => findManyLedgerMock(...args),
      updateMany: (...args: unknown[]) => ledgerUpdateManyMock(...args),
    },
    tenantMemoryItem: {
      findMany: (...args: unknown[]) => findManyMemoryMock(...args),
    },
    globalSignal: {
      findMany: (...args: unknown[]) => findManyGlobalMock(...args),
    },
    $transaction: (...args: unknown[]) => finalizeTxMock(...args),
  }),
}));

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";

const TENANT = "tenant-telemetry";
const ANALYSIS = "analysis-telemetry";
const TRACE_ID = "trace-from-ingest-XYZ";

function llmResponseFor(task: string) {
  if (task === "normalization") {
    return {
      content: JSON.stringify([
        { entryId: "e1", date: "2026-04-01", description: "NF 001", normalizedDescription: "NF 001", amountCents: 100000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
        { entryId: "e2", date: "2026-04-02", description: "NF 002", normalizedDescription: "NF 002", amountCents: 120000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
        { entryId: "e3", date: "2026-04-03", description: "NF 003", normalizedDescription: "NF 003", amountCents: 110000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
        { entryId: "e4", date: "2026-04-04", description: "Aluguel", normalizedDescription: "Aluguel", amountCents: 30000, direction: "out", documentType: "boleto", features: [], noiseFlags: [] },
      ]),
      provider: "openai", model: "gpt-4.1-nano",
      inputTokens: 100, outputTokens: 200, costCents: 11, traceId: "llm-norm",
    };
  }
  if (task === "clarity-judge") {
    return {
      content: JSON.stringify([
        { entryId: "e1", clarity: "clear", reason: "NF" },
        { entryId: "e2", clarity: "clear", reason: "NF" },
        { entryId: "e3", clarity: "clear", reason: "NF" },
        { entryId: "e4", clarity: "clear", reason: "boleto" },
      ]),
      provider: "openai", model: "gpt-4.1-nano",
      inputTokens: 50, outputTokens: 80, costCents: 13, traceId: "llm-clar",
    };
  }
  if (task === "dre-classification") {
    return {
      content: JSON.stringify([
        { entryId: "e1", category: "receita_bruta", confidence: 0.9 },
        { entryId: "e2", category: "receita_bruta", confidence: 0.9 },
        { entryId: "e3", category: "receita_bruta", confidence: 0.9 },
        { entryId: "e4", category: "despesas_administrativas", confidence: 0.9 },
      ]),
      provider: "openai", model: "gpt-4.1-mini",
      inputTokens: 200, outputTokens: 200, costCents: 17, traceId: "llm-dre",
    };
  }
  if (task === "narrative-synthesis") {
    return {
      content: JSON.stringify([
        { type: "critical_gap", title: "Margem apertada", body: "A operação ficou com folga estreita após despesas no período avaliado.", evidenceRefs: ["margemOperacional"] },
        { type: "attention", title: "Despesas administrativas relevantes", body: "Os custos administrativos foram materialmente representativos diante da receita bruta.", evidenceRefs: ["despesasAdm"] },
        { type: "healthy", title: "Receita estável", body: "O faturamento bruto manteve estabilidade ao longo das semanas analisadas.", evidenceRefs: ["receitaBruta"] },
      ]),
      provider: "google", model: "gemini-2.5-flash",
      inputTokens: 500, outputTokens: 400, costCents: 19, traceId: "llm-narr",
    };
  }
  if (task === "action-planning") {
    return {
      content: JSON.stringify({
        actions: [
          { horizon: "short", title: "Renegociar aluguel", description: "Negociar reduzir aluguel mensal.", effortLevel: "low", riskLevel: "low", impactCents: 5000, doneWhen: "Aluguel reduzido em 10% até o fim do mês registrado em contrato", evidenceRefs: ["despesasAdm"], assumptions: [], confidence: 0.7 },
          { horizon: "short", title: "Cobrar recebíveis em atraso", description: "Listar e cobrar inadimplentes.", effortLevel: "low", riskLevel: "low", impactCents: 3000, doneWhen: "Lista entregue + R$3000 recuperado em 30 dias", evidenceRefs: ["receitaBruta"], assumptions: [], confidence: 0.65 },
          { horizon: "short", title: "Revisar fornecedores recorrentes", description: "Top 5 fornecedores re-cotados.", effortLevel: "low", riskLevel: "low", impactCents: 2000, doneWhen: "2 fornecedores recotados e 5% reduzido registrado em planilha até o fim do mês", evidenceRefs: ["despesasAdm"], assumptions: [], confidence: 0.6 },
          { horizon: "medium", title: "Implantar controle orçamentário mensal", description: "Aprovar despesas acima de R$500 e revisar mensalmente o orçamento por centro.", effortLevel: "medium", riskLevel: "medium", impactCents: 10000, doneWhen: "Processo aprovado pelo CEO e em uso por 60 dias com 3 revisões registradas", evidenceRefs: ["margemOperacional"], assumptions: [], confidence: 0.7 },
          { horizon: "long", title: "Avaliar automação financeira", description: "Pesquisar ferramentas de automação para reduzir despesas administrativas.", effortLevel: "high", riskLevel: "medium", impactCents: 30000, doneWhen: "Ferramenta homologada e ROI medido em 6 meses comparado ao baseline", evidenceRefs: ["despesasAdm"], assumptions: [], confidence: 0.6 },
        ],
      }),
      provider: "google", model: "gemini-2.5-flash",
      inputTokens: 600, outputTokens: 500, costCents: 23, traceId: "llm-act",
    };
  }
  if (task === "financial-qa-review") {
    return {
      content: JSON.stringify({ publishable: true, issues: [], retryTargets: [] }),
      provider: "openai", model: "gpt-4.1-mini",
      inputTokens: 400, outputTokens: 100, costCents: 29, traceId: "llm-qa",
    };
  }
  throw new Error(`Mock não cobre task: ${task}`);
}

beforeEach(() => {
  findUniqueAnalysisMock.mockReset();
  findManyAnalysesMock.mockReset();
  findManyLedgerMock.mockReset();
  callLlmMock.mockReset();
  finalizeUpdateMock.mockClear();

  findManyAnalysesMock.mockResolvedValue([]);

  findUniqueAnalysisMock.mockImplementation((args: { select?: { mode?: boolean; costCents?: boolean } }) => {
    // load_analysis vs finalize têm select diferentes — distingue pela presença de "tenant"
    const wantsLoadFields = !args.select?.mode;
    if (wantsLoadFields) {
      return Promise.resolve({
        id: ANALYSIS,
        tenantId: TENANT,
        status: "pending",
        referenceMonth: "2026-04",
        openingBalanceCents: null,
        tenant: { industrySegment: "servicos-b2b", taxRegime: "simples", productConfig: {} },
      });
    }
    return Promise.resolve({ mode: "shadow", costCents: 0 });
  });

  findManyLedgerMock.mockResolvedValue([
    { id: "e1", date: new Date("2026-04-01T10:00:00Z"), description: "NF 001", amountCents: 100000, direction: "credit" },
    { id: "e2", date: new Date("2026-04-02T10:00:00Z"), description: "NF 002", amountCents: 120000, direction: "credit" },
    { id: "e3", date: new Date("2026-04-03T10:00:00Z"), description: "NF 003", amountCents: 110000, direction: "credit" },
    { id: "e4", date: new Date("2026-04-04T10:00:00Z"), description: "Aluguel", amountCents: 30000, direction: "debit" },
  ]);

  callLlmMock.mockImplementation(async ({ task }: { task: string }) => llmResponseFor(task));
});

describe("graph telemetria — costs + traces acumulam até o finalize (achado A)", () => {
  it("acumula AgentCost de cada nó LLM no estado final", async () => {
    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    // 6 nós LLM emitem cost: normalization, clarity, dre-classification,
    // narrative-synthesis, action-planning, financial-qa-review
    expect(result.costs.length).toBe(6);
    const agents = result.costs.map((c: { agent: string }) => c.agent).sort();
    expect(agents).toEqual([
      "action-planning",
      "clarity-judge",
      "dre-classification",
      "financial-qa-review",
      "narrative-synthesis",
      "normalization",
    ]);

    // costCents totalizados: 11 + 13 + 17 + 19 + 23 + 0 = 83
    // (financial-qa-review é determinístico agora → emite AgentCost mas com costCents 0)
    const total = result.costs.reduce((acc: number, c: { costCents: number }) => acc + c.costCents, 0);
    expect(total).toBe(83);
  });

  it("emite AgentTrace tanto para nós LLM quanto para nós rule-based", async () => {
    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    const agents = result.traces.map((t: { agent: string }) => t.agent).sort();
    // 6 LLM + 3 rule-based (anomaly-detection, margin-diagnosis, cashflow-risk)
    expect(agents).toEqual([
      "action-planning",
      "anomaly-detection",
      "cashflow-risk",
      "clarity-judge",
      "dre-classification",
      "financial-qa-review",
      "margin-diagnosis",
      "narrative-synthesis",
      "normalization",
    ]);
  });

  it("finalize persiste costCents real (>0) somando o custo do mês", async () => {
    const graph = buildMonthlyAnalysisGraph();

    await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    expect(finalizeUpdateMock).toHaveBeenCalled();
    const last = finalizeUpdateMock.mock.calls.at(-1)!;
    const data = (last[0] as { data: { costCents: number } }).data;
    expect(data.costCents).toBe(83);
  });
});

describe("graph traceId propagation (C6)", () => {
  it("encaminha state.traceId para todas as chamadas callLlm", async () => {
    const graph = buildMonthlyAnalysisGraph();

    await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      traceId: TRACE_ID,
      costs: [],
      traces: [],
      errors: [],
    });

    for (const call of callLlmMock.mock.calls) {
      const req = call[0] as { traceId?: string; tenantId: string };
      expect(req.traceId).toBe(TRACE_ID);
    }
  });

  it("quando state.traceId é ausente, chamadas vão com traceId undefined (não quebra)", async () => {
    const graph = buildMonthlyAnalysisGraph();

    await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    expect(callLlmMock).toHaveBeenCalled();
    for (const call of callLlmMock.mock.calls) {
      const req = call[0] as { traceId?: string };
      expect(req.traceId).toBeUndefined();
    }
  });
});
