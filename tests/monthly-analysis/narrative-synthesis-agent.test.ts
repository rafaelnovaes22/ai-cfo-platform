import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { runNarrativeSynthesisAgent } from "@/monthly-analysis/agents/narrative-synthesis.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/narrative-synthesis.js";
import {
  NarrativeCardDraftsSchema,
  type Anomaly,
  type CashflowRisk,
  type MarginDiagnosis,
  type NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

beforeEach(() => {
  callLlmMock.mockReset();
});

function makeDre(overrides: Partial<DreLines> = {}): DreLines {
  return {
    receitaBruta: 10000000,
    deducoes: 500000,
    receitaLiquida: 9500000,
    custosDiretos: 4500000,
    lucroBruto: 5000000,
    margemBruta: 52.63,
    despesasPessoal: 2500000,
    prolabore: 500000,
    despesasAdm: 300000,
    despesasComerciais: 250000,
    despesasTi: 100000,
    despesasViagem: 80000,
    despesasJuridicas: 70000,
    despesasFinanceiras: 200000,
    outrasDespesas: 50000,
    outrasReceitasOp: 0,
    totalDespesasOp: 3850000,
    ebitda: 1150000,
    margemEbitda: 12.1,
    depreciacao: 50000,
    amortizacao: 30000,
    ebit: 1070000,
    margemOperacional: 11.26,
    receitaFinanceira: 10000,
    resultadoFinanceiro: -190000,
    resultadoAntesImpostos: 880000,
    impostos: 220000,
    lucroLiquido: 660000,
    margemLiquida: 6.95,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
    ...overrides,
  };
}

const anomalies: Anomaly[] = [
  {
    code: "thin_operating_margin",
    title: "Margem operacional estreita",
    description: "Operação com folga reduzida frente a oscilações.",
    severity: "medium",
    evidenceMetric: "margem_operacional=11.26%",
  },
];

const marginDiagnosis: MarginDiagnosis = {
  grossMarginStatus: "healthy",
  operatingMarginStatus: "attention",
  mainDrivers: [
    {
      driver: "Despesa operacional dominante: despesas com pessoal",
      evidenceMetric: "margem_operacional=11.26%; despesas com pessoal=R$ 25.000,00",
      impactCents: 2500000,
      severity: "medium",
    },
  ],
};

const cashflowRisk: CashflowRisk = {
  status: "healthy",
  reasons: ["Entradas cobrem saídas com folga líquida de 18%."],
  limitations: [],
};

function validCards(): NarrativeCardDraft[] {
  return [
    {
      type: "critical_gap",
      title: "Despesa de pessoal pressiona margem operacional",
      body: "Despesas com pessoal de R$ 25.000 reduzem margem operacional para 11,26%. Renegocie contratos de pessoal com prazo de 30 dias e estabeleça meta de margem em 15%.",
      evidenceRefs: ["despesasPessoal", "margemOperacional", "thin_operating_margin"],
    },
    {
      type: "attention",
      title: "Margem líquida ainda abaixo de 10%",
      body: "Margem líquida de 6,95% deixa pouca folga. Defina meta de margem líquida em 10% para o próximo trimestre e corte despesas administrativas em 15%.",
      evidenceRefs: ["margemLiquida", "marginDiagnosis.operatingMarginStatus=attention"],
    },
    {
      type: "healthy",
      title: "Margem bruta saudável",
      body: "Margem bruta de 52,63% mostra precificação adequada. Expanda esse padrão lançando novos produtos com mix similar.",
      evidenceRefs: ["margemBruta", "lucroBruto"],
    },
  ];
}

describe("NarrativeCardDraftsSchema composition", () => {
  it("aceita exatamente 3 cards (um de cada tipo)", () => {
    expect(() => NarrativeCardDraftsSchema.parse(validCards())).not.toThrow();
  });

  it("rejeita 2 cards (composição incompleta)", () => {
    const cards = validCards().slice(0, 2);
    expect(() => NarrativeCardDraftsSchema.parse(cards)).toThrow();
  });

  it("rejeita 4 cards", () => {
    const cards = [...validCards(), {
      type: "attention" as const,
      title: "Card extra",
      body: "Card a mais quebra contrato.",
      evidenceRefs: ["lucroLiquido"],
    }];
    expect(() => NarrativeCardDraftsSchema.parse(cards)).toThrow();
  });

  it("rejeita 3 cards com dois do mesmo tipo (falta critical_gap)", () => {
    const cards = validCards();
    cards[0] = { ...cards[0]!, type: "attention" };
    // Agora temos 2 attention + 1 healthy, sem critical_gap — total ainda 3.
    expect(() => NarrativeCardDraftsSchema.parse(cards)).toThrow();
  });

  it("rejeita 3 cards com dois healthy", () => {
    const cards = validCards();
    cards[1] = { ...cards[1]!, type: "healthy" };
    expect(() => NarrativeCardDraftsSchema.parse(cards)).toThrow();
  });
});

describe("buildSystemPrompt / buildUserPrompt", () => {
  it("system prompt cita regras de evidenceRefs (métrica/anomaly/diagnosis)", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain("evidenceRefs");
    expect(sys).toMatch(/métrica do objeto DRE/);
    expect(sys).toMatch(/code de anomalia/);
    expect(sys).toMatch(/status do diagnóstico/);
    // Verbos proibidos herdados de dre-narrative
    expect(sys).toContain("monitorar");
    expect(sys).toContain("PROIBIDOS");
  });

  it("system prompt inclui exemplo completo, terminologia por segmento, tom de voz e anti-benchmark", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain("EXEMPLO COMPLETO");
    expect(sys).toContain("critical_gap");
    expect(sys).toContain("evidenceRefs");
    expect(sys).toContain("TERMINOLOGIA POR SEGMENTO");
    expect(sys).toContain("varejo");
    expect(sys).toContain("TOM DE VOZ");
    expect(sys).toContain("toneOfVoice=formal");
    expect(sys).toContain("ANTI-BENCHMARK");
  });

  it("user prompt injeta DRE, anomalias, diagnóstico, cashflow e sinais calculados", () => {
    const prompt = buildUserPrompt({
      dre: makeDre(),
      anomalies,
      marginDiagnosis,
      cashflowRisk,
      referenceMonth: "2026-04",
      segment: "tecnologia",
      taxRegime: "simples",
      toneOfVoice: "direto",
    });

    expect(prompt).toContain("tecnologia");
    expect(prompt).toContain("simples");
    expect(prompt).toContain("DRE FACILITADO");
    expect(prompt).toContain("thin_operating_margin");
    expect(prompt).toContain("grossMarginStatus=healthy");
    expect(prompt).toContain("operatingMarginStatus=attention");
    expect(prompt).toContain("status=healthy");
    expect(prompt).toContain("SINAIS CALCULADOS");
    expect(prompt).toContain("PRIORIDADES OBRIGATORIAS");
  });

  it("sinais dispararam prioridade de pessoal quando >= 40% da receita líquida", () => {
    // despesasPessoal 2.500.000 + prolabore 1.500.000 = 4.000.000 / receitaLiquida 9.500.000 = 42,1%
    const prompt = buildUserPrompt({
      dre: makeDre({ prolabore: 1_500_000 }),
      anomalies: [],
      marginDiagnosis,
      cashflowRisk,
      segment: "servicos-b2b",
      taxRegime: "simples",
      toneOfVoice: "formal",
    });
    expect(prompt).toContain("pessoal + pro-labore >= 40%");
  });

  it("sinais não disparam prioridade de pessoal quando < 40% da receita líquida", () => {
    // despesasPessoal 2.500.000 + prolabore 500.000 = 3.000.000 / receitaLiquida 9.500.000 = 31,6%
    const prompt = buildUserPrompt({
      dre: makeDre(),
      anomalies: [],
      marginDiagnosis,
      cashflowRisk,
      segment: "servicos-b2b",
      taxRegime: "simples",
      toneOfVoice: "formal",
    });
    expect(prompt).not.toContain("pessoal + pro-labore >= 40%");
  });
});

describe("runNarrativeSynthesisAgent", () => {
  it("chama callLlm com task=narrative-synthesis e devolve cards validados", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify(validCards()),
      provider: "google",
      model: "gemini-2.5-pro",
      inputTokens: 200,
      outputTokens: 150,
      costCents: 3,
      traceId: null,
    });

    const result = await runNarrativeSynthesisAgent(
      { dre: makeDre(), anomalies, marginDiagnosis, cashflowRisk },
      { tenantId: "tenant-1", traceId: "trace-x" },
    );

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.type).sort()).toEqual(["attention", "critical_gap", "healthy"]);
    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "narrative-synthesis",
      tenantId: "tenant-1",
      traceId: "trace-x",
      jsonMode: true,
    }));
  });

  it("falha quando o LLM devolve composição inválida (dois critical_gap)", async () => {
    const broken = validCards();
    broken[1] = { ...broken[1]!, type: "critical_gap" };

    callLlmMock.mockResolvedValue({
      content: JSON.stringify(broken),
      provider: "google",
      model: "gemini-2.5-pro",
      inputTokens: 200,
      outputTokens: 150,
      costCents: 3,
      traceId: null,
    });

    await expect(runNarrativeSynthesisAgent(
      { dre: makeDre(), anomalies, marginDiagnosis, cashflowRisk },
      { tenantId: "tenant-1" },
    )).rejects.toThrow();
  });

  it("falha quando o LLM devolve quantidade errada de cards", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify(validCards().slice(0, 2)),
      provider: "google",
      model: "gemini-2.5-pro",
      inputTokens: 200,
      outputTokens: 150,
      costCents: 3,
      traceId: null,
    });

    await expect(runNarrativeSynthesisAgent(
      { dre: makeDre(), anomalies, marginDiagnosis, cashflowRisk },
      { tenantId: "tenant-1" },
    )).rejects.toThrow();
  });
});
