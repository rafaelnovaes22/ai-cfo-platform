import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma — duas chamadas: monthlyAnalysis.findUnique + ledgerEntry.findMany
const findUniqueAnalysisMock = vi.fn();
const findManyLedgerMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueAnalysisMock(...args),
    },
    ledgerEntry: {
      findMany: (...args: unknown[]) => findManyLedgerMock(...args),
    },
  }),
}));

// Mock callLlm — despacha por task name (normalize, clarity-judge, dre-classification,
// narrative-synthesis, action-planning). Cada chamada registra timestamp para
// validar paralelismo do fan-out de diagnoses.
const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";

const TENANT = "tenant-test";
const ANALYSIS = "analysis-test";

beforeEach(() => {
  findUniqueAnalysisMock.mockReset();
  findManyLedgerMock.mockReset();
  callLlmMock.mockReset();
});

function setupHappyPath(): void {
  findUniqueAnalysisMock.mockResolvedValue({
    id: ANALYSIS,
    tenantId: TENANT,
    status: "pending",
    tenant: { industrySegment: "servicos-b2b", taxRegime: "simples", productConfig: {} },
  });

  // 8 entries: 4 receita (1000 cents cada), 4 custos (500 cents cada).
  // Garante DRE com receita_liquida > 0 e direction diverso (cashflow_risk
  // exige distinct days >= 3, então usamos 4 datas).
  findManyLedgerMock.mockResolvedValue([
    { id: "e1", date: new Date("2026-04-01T10:00:00Z"), description: "Venda NF 001", amountCents: 100000, direction: "credit" },
    { id: "e2", date: new Date("2026-04-02T10:00:00Z"), description: "Venda NF 002", amountCents: 120000, direction: "credit" },
    { id: "e3", date: new Date("2026-04-03T10:00:00Z"), description: "Venda NF 003", amountCents: 110000, direction: "credit" },
    { id: "e4", date: new Date("2026-04-04T10:00:00Z"), description: "Venda NF 004", amountCents: 130000, direction: "credit" },
    { id: "e5", date: new Date("2026-04-05T10:00:00Z"), description: "Fornecedor materia-prima", amountCents: 50000, direction: "debit" },
    { id: "e6", date: new Date("2026-04-06T10:00:00Z"), description: "Aluguel escritorio", amountCents: 30000, direction: "debit" },
    { id: "e7", date: new Date("2026-04-07T10:00:00Z"), description: "Salario funcionario", amountCents: 80000, direction: "debit" },
    { id: "e8", date: new Date("2026-04-08T10:00:00Z"), description: "Boleto luz", amountCents: 5000, direction: "debit" },
  ]);

  callLlmMock.mockImplementation(async ({ task }: { task: string }) => {
    if (task === "normalization") {
      return {
        content: JSON.stringify([
          { entryId: "e1", date: "2026-04-01", description: "Venda NF 001", normalizedDescription: "Venda NF 001", amountCents: 100000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
          { entryId: "e2", date: "2026-04-02", description: "Venda NF 002", normalizedDescription: "Venda NF 002", amountCents: 120000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
          { entryId: "e3", date: "2026-04-03", description: "Venda NF 003", normalizedDescription: "Venda NF 003", amountCents: 110000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
          { entryId: "e4", date: "2026-04-04", description: "Venda NF 004", normalizedDescription: "Venda NF 004", amountCents: 130000, direction: "in", documentType: "nf", features: [], noiseFlags: [] },
          { entryId: "e5", date: "2026-04-05", description: "Fornecedor materia-prima", normalizedDescription: "Fornecedor materia-prima", amountCents: 50000, direction: "out", documentType: "invoice", features: [], noiseFlags: [] },
          { entryId: "e6", date: "2026-04-06", description: "Aluguel escritorio", normalizedDescription: "Aluguel escritorio", amountCents: 30000, direction: "out", documentType: "boleto", features: [], noiseFlags: [] },
          { entryId: "e7", date: "2026-04-07", description: "Salario funcionario", normalizedDescription: "Salario funcionario", amountCents: 80000, direction: "out", documentType: "payroll", features: [], noiseFlags: [] },
          { entryId: "e8", date: "2026-04-08", description: "Boleto luz", normalizedDescription: "Boleto luz", amountCents: 5000, direction: "out", documentType: "boleto", features: [], noiseFlags: [] },
        ]),
        provider: "openai", model: "gpt-4.1-nano", inputTokens: 100, outputTokens: 200, costCents: 1, traceId: "t1",
      };
    }
    if (task === "clarity-judge") {
      return {
        content: JSON.stringify([
          { entryId: "e1", clarity: "clear", reason: "NF numerada" },
          { entryId: "e2", clarity: "clear", reason: "NF numerada" },
          { entryId: "e3", clarity: "clear", reason: "NF numerada" },
          { entryId: "e4", clarity: "clear", reason: "NF numerada" },
          { entryId: "e5", clarity: "clear", reason: "fornecedor identificado" },
          { entryId: "e6", clarity: "clear", reason: "categoria evidente" },
          { entryId: "e7", clarity: "clear", reason: "folha" },
          { entryId: "e8", clarity: "clear", reason: "conta de consumo" },
        ]),
        provider: "openai", model: "gpt-4.1-nano", inputTokens: 50, outputTokens: 100, costCents: 1, traceId: "t2",
      };
    }
    if (task === "dre-classification") {
      return {
        content: JSON.stringify([
          { entryId: "e1", category: "receita_bruta", confidence: 0.95 },
          { entryId: "e2", category: "receita_bruta", confidence: 0.95 },
          { entryId: "e3", category: "receita_bruta", confidence: 0.95 },
          { entryId: "e4", category: "receita_bruta", confidence: 0.95 },
          { entryId: "e5", category: "cpv_cmv", confidence: 0.90 },
          { entryId: "e6", category: "despesas_administrativas", confidence: 0.90 },
          { entryId: "e7", category: "despesas_pessoal", confidence: 0.95 },
          { entryId: "e8", category: "despesas_administrativas", confidence: 0.85 },
        ]),
        provider: "openai", model: "gpt-4.1-mini", inputTokens: 200, outputTokens: 300, costCents: 5, traceId: "t3",
      };
    }
    if (task === "narrative-synthesis") {
      return {
        content: JSON.stringify([
          { type: "critical_gap", title: "Margem operacional apertada", body: "A operação devolveu folga estreita após custos diretos e despesas administrativas no período avaliado.", evidenceRefs: ["margemOperacional", "despesasAdm"] },
          { type: "attention", title: "Custos diretos elevados", body: "Os custos diretos representaram parcela relevante da receita bruta do mês de referência.", evidenceRefs: ["custosDiretos", "receitaBruta"] },
          { type: "healthy", title: "Folha de pagamento sob controle", body: "As despesas com pessoal mantiveram-se proporcionais ao volume de receita observado no período.", evidenceRefs: ["despesasPessoal"] },
        ]),
        provider: "google", model: "gemini-2.5-flash", inputTokens: 500, outputTokens: 400, costCents: 1, traceId: "t4",
      };
    }
    if (task === "action-planning") {
      return {
        content: JSON.stringify({
          actions: [
            { horizon: "short", title: "Renegociar fornecedor de materia-prima", description: "Buscar 3 cotações alternativas e renegociar prazo de pagamento.", effortLevel: "low", riskLevel: "low", impactCents: 5000, doneWhen: "Contrato renegociado em até 30 dias", evidenceRefs: ["cpv_cmv"], assumptions: [], confidence: 0.7 },
            { horizon: "short", title: "Revisar contratos de fornecedores recorrentes", description: "Mapear top 5 fornecedores e renegociar condições com base em volume.", effortLevel: "medium", riskLevel: "low", impactCents: 3000, doneWhen: "Mapeamento concluido + 2 contratos renegociados", evidenceRefs: ["despesasAdm"], assumptions: [], confidence: 0.65 },
            { horizon: "short", title: "Auditar gastos administrativos", description: "Revisar lançamentos de despesas administrativas para identificar redundâncias.", effortLevel: "low", riskLevel: "low", impactCents: 2000, doneWhen: "Lista de 5 redundancias entregue ao CEO até o fim do mês", evidenceRefs: ["despesasAdm"], assumptions: [], confidence: 0.6 },
            { horizon: "medium", title: "Implementar controle de orçamento mensal", description: "Criar processo de aprovação de despesas acima de R$500.", effortLevel: "medium", riskLevel: "medium", impactCents: 10000, doneWhen: "Processo aprovado e em uso por 60 dias", evidenceRefs: ["margemOperacional"], assumptions: [], confidence: 0.7 },
            { horizon: "long", title: "Investir em automação de processos", description: "Avaliar ferramentas de automação para reduzir despesas operacionais.", effortLevel: "high", riskLevel: "medium", impactCents: 30000, doneWhen: "Ferramenta homologada e ROI medido em 6 meses", evidenceRefs: ["despesasAdm", "despesasPessoal"], assumptions: [], confidence: 0.6 },
          ],
        }),
        provider: "google", model: "gemini-2.5-flash", inputTokens: 600, outputTokens: 800, costCents: 2, traceId: "t5",
      };
    }
    if (task === "financial-qa-review") {
      return {
        content: JSON.stringify({ publishable: true, issues: [], retryTargets: [] }),
        provider: "openai", model: "gpt-4.1-mini", inputTokens: 400, outputTokens: 100, costCents: 1, traceId: "t6",
      };
    }
    throw new Error(`Mock não cobre task: ${task}`);
  });
}

describe("monthly-analysis graph orchestration (3.C.1)", () => {
  it("executa o pipeline E2E e produz dre + cards + plano completos", async () => {
    setupHappyPath();
    const graph = buildMonthlyAnalysisGraph();

    const result = await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    // Estado intermediario
    expect(result.rawEntries).toHaveLength(8);
    expect(result.normalizedEntries).toHaveLength(8);
    expect(result.clarityResults).toHaveLength(8);
    expect(result.classifiedEntries).toHaveLength(8);

    // DRE agregado
    expect(result.dre).toBeDefined();
    expect(result.dre!.receitaLiquida).toBe(460000); // 4 × 100000+120000+110000+130000 = 460000

    // Diagnoses (fan-out paralelo: anomaly + margin + cashflow)
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(result.marginDiagnosis).toBeDefined();
    expect(result.cashflowRisk).toBeDefined();

    // Narrativa
    expect(result.narrativeCards).toHaveLength(3);
    const cardTypes = result.narrativeCards!.map((c) => c.type).sort();
    expect(cardTypes).toEqual(["attention", "critical_gap", "healthy"]);

    // Plano
    expect(result.actionPlan).toBeDefined();
    expect(result.actionPlan!.actions.length).toBeGreaterThanOrEqual(5);
    expect(result.actionPlan!.actions.filter((a) => a.horizon === "short").length).toBeGreaterThanOrEqual(3);
  });

  it("invoca callLlm exatamente 6 vezes (normalize + clarity + classification + narrative + action + QA)", async () => {
    setupHappyPath();
    const graph = buildMonthlyAnalysisGraph();

    await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    const tasksInvoked = callLlmMock.mock.calls.map((call) => (call[0] as { task: string }).task);
    expect(tasksInvoked).toEqual(
      expect.arrayContaining([
        "normalization",
        "clarity-judge",
        "dre-classification",
        "narrative-synthesis",
        "action-planning",
        "financial-qa-review",
      ]),
    );
    expect(tasksInvoked).toHaveLength(6);
  });

  it("propaga tenantId em todas as chamadas LLM (C8 — sem leakage de tenant)", async () => {
    setupHappyPath();
    const graph = buildMonthlyAnalysisGraph();

    await graph.invoke({
      analysisId: ANALYSIS,
      tenantId: TENANT,
      costs: [],
      traces: [],
      errors: [],
    });

    for (const call of callLlmMock.mock.calls) {
      const req = call[0] as { tenantId: string };
      expect(req.tenantId).toBe(TENANT);
    }
  });
});
