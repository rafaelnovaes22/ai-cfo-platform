import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const findManyAnalysesMock = vi.fn();
const findManyLedgerMock = vi.fn();
const findManyMemoryMock = vi.fn();
const findManyGlobalMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    monthlyAnalysis: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyAnalysesMock(...args),
    },
    ledgerEntry: {
      findMany: (...args: unknown[]) => findManyLedgerMock(...args),
    },
    tenantMemoryItem: {
      findMany: (...args: unknown[]) => findManyMemoryMock(...args),
    },
    globalSignal: {
      findMany: (...args: unknown[]) => findManyGlobalMock(...args),
    },
  }),
}));

import { loadAnalysisNode } from "@/monthly-analysis/graph/nodes/load-analysis.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

function baseState(overrides?: Partial<MonthlyAnalysisState>): MonthlyAnalysisState {
  return {
    analysisId: "analysis-1",
    tenantId: "tenant-1",
    costs: [],
    traces: [],
    errors: [],
    ...overrides,
  };
}

function baseAnalysis(overrides?: object) {
  return {
    id: "analysis-1",
    tenantId: "tenant-1",
    status: "generating",
    referenceMonth: "2026-05",
    openingBalanceCents: null,
    tenant: { industrySegment: "servicos-b2b", taxRegime: "simples", productConfig: {} },
    ...overrides,
  };
}

function dreFixture(revenue: number) {
  return {
    receitaBruta: revenue,
    deducoes: 0,
    receitaLiquida: revenue,
    custosDiretos: 0,
    lucroBruto: revenue,
    margemBruta: 100,
    despesasPessoal: 0,
    prolabore: 0,
    despesasAdm: 0,
    despesasComerciais: 0,
    despesasTi: 0,
    despesasViagem: 0,
    despesasJuridicas: 0,
    despesasFinanceiras: 0,
    outrasDespesas: 0,
    outrasReceitasOp: 0,
    totalDespesasOp: 0,
    ebitda: revenue,
    margemEbitda: 100,
    depreciacao: 0,
    amortizacao: 0,
    ebit: revenue,
    margemOperacional: 100,
    receitaFinanceira: 0,
    resultadoFinanceiro: 0,
    resultadoAntesImpostos: revenue,
    impostos: 0,
    lucroLiquido: revenue,
    margemLiquida: 100,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
  };
}

beforeEach(() => {
  findUniqueMock.mockReset();
  findManyAnalysesMock.mockReset();
  findManyLedgerMock.mockReset();
  findManyMemoryMock.mockReset();
  findManyGlobalMock.mockReset();
  findManyLedgerMock.mockResolvedValue([]);
  findManyMemoryMock.mockResolvedValue([]);
  findManyGlobalMock.mockResolvedValue([]);
});

describe("loadAnalysisNode — previousDre e historicalDre", () => {
  it("popula previousDre com o mês imediatamente anterior quando existe análise fechada", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis());
    const prevDre = dreFixture(100_000_00);
    findManyAnalysesMock.mockResolvedValueOnce([
      { referenceMonth: "2026-04", dreJson: prevDre },
    ]);

    const result = await loadAnalysisNode(baseState());

    expect(result.previousDre).toEqual(prevDre);
    expect(result.historicalDre).toEqual([prevDre]);
  });

  it("historicalDre fica ordenado do mais antigo ao mais recente", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis());
    const dre03 = dreFixture(80_000_00);
    const dre04 = dreFixture(90_000_00);
    const dre02 = dreFixture(70_000_00);
    // Prisma retorna desc — loader reverte para asc
    findManyAnalysesMock.mockResolvedValueOnce([
      { referenceMonth: "2026-04", dreJson: dre04 },
      { referenceMonth: "2026-03", dreJson: dre03 },
      { referenceMonth: "2026-02", dreJson: dre02 },
    ]);

    const result = await loadAnalysisNode(baseState());

    expect(result.historicalDre).toEqual([dre02, dre03, dre04]);
    expect(result.previousDre).toEqual(dre04);
  });

  it("previousDre é undefined e historicalDre é [] quando não há análises anteriores", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis());
    findManyAnalysesMock.mockResolvedValueOnce([]);

    const result = await loadAnalysisNode(baseState());

    expect(result.previousDre).toBeUndefined();
    expect(result.historicalDre).toEqual([]);
  });

  it("ignora registros históricos sem dreJson (análises geradas mas sem DRE)", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis());
    const validDre = dreFixture(100_000_00);
    findManyAnalysesMock.mockResolvedValueOnce([
      { referenceMonth: "2026-04", dreJson: validDre },
      { referenceMonth: "2026-03", dreJson: null },
    ]);

    const result = await loadAnalysisNode(baseState());

    expect(result.historicalDre).toHaveLength(1);
    expect(result.historicalDre![0]).toEqual(validDre);
    expect(result.previousDre).toEqual(validDre);
  });

  it("consulta Prisma filtrando referenceMonth < mês atual e status fechado", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis({ referenceMonth: "2026-05" }));
    findManyAnalysesMock.mockResolvedValueOnce([]);

    await loadAnalysisNode(baseState());

    expect(findManyAnalysesMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        referenceMonth: { lt: "2026-05" },
        status: { in: ["ready", "delivered", "approved"] },
      }),
      orderBy: { referenceMonth: "desc" },
      take: 12,
    }));
  });
});

describe("loadAnalysisNode — openingBalance", () => {
  it("popula openingBalance quando openingBalanceCents está preenchido", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis({ openingBalanceCents: 5_000_000 }));
    findManyAnalysesMock.mockResolvedValueOnce([]);

    const result = await loadAnalysisNode(baseState());

    expect(result.openingBalance).toBe(5_000_000);
  });

  it("openingBalance é undefined quando openingBalanceCents é null", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis({ openingBalanceCents: null }));
    findManyAnalysesMock.mockResolvedValueOnce([]);

    const result = await loadAnalysisNode(baseState());

    expect(result.openingBalance).toBeUndefined();
  });
});

describe("loadAnalysisNode — carregamento de entries e tenant", () => {
  it("retorna rawEntries mapeados corretamente do banco", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis());
    findManyAnalysesMock.mockResolvedValueOnce([]);
    findManyLedgerMock.mockResolvedValueOnce([
      { id: "e1", date: new Date("2026-05-10"), description: "NF 1234", amountCents: 100_000, direction: "credit" },
      { id: "e2", date: new Date("2026-05-15"), description: "Aluguel", amountCents: 30_000, direction: "debit" },
    ]);

    const result = await loadAnalysisNode(baseState());

    expect(result.rawEntries).toEqual([
      { entryId: "e1", date: "2026-05-10", description: "NF 1234", amountCents: 100_000, direction: "in" },
      { entryId: "e2", date: "2026-05-15", description: "Aluguel", amountCents: 30_000, direction: "out" },
    ]);
  });

  it("popula segment, taxRegime e toneOfVoice do tenant", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis({
      tenant: {
        industrySegment: "saas",
        taxRegime: "lucro-presumido",
        productConfig: { monthlyAnalysis: { toneOfVoice: "informal" } },
      },
    }));
    findManyAnalysesMock.mockResolvedValueOnce([]);

    const result = await loadAnalysisNode(baseState());

    expect(result.segment).toBe("saas");
    expect(result.taxRegime).toBe("lucro-presumido");
    expect(result.toneOfVoice).toBe("informal");
  });

  it("retorna {} sem chamar findMany quando analysis não existe no Prisma", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await loadAnalysisNode(baseState());

    expect(result).toEqual({});
    expect(findManyAnalysesMock).not.toHaveBeenCalled();
    expect(findManyLedgerMock).not.toHaveBeenCalled();
  });

  it("retorna {} sem chamar findMany quando há tenant mismatch", async () => {
    findUniqueMock.mockResolvedValueOnce(baseAnalysis({ tenantId: "outro-tenant" }));

    const result = await loadAnalysisNode(baseState());

    expect(result).toEqual({});
    expect(findManyAnalysesMock).not.toHaveBeenCalled();
    expect(findManyLedgerMock).not.toHaveBeenCalled();
  });
});
