import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { runActionPlanningAgent, sortShortsByRoi } from "@/monthly-analysis/agents/action-planning.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/action-planning.js";
import {
  ActionPlanDraftSchema,
  type ActionPlanItemDraft,
  type Anomaly,
  type CashflowRisk,
  type MarginDiagnosis,
  type NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

const baseDre: DreLines = {
  receitaBruta: 10_000_00,
  deducoes: 500_00,
  receitaLiquida: 9_500_00,
  custosDiretos: 4_000_00,
  lucroBruto: 5_500_00,
  margemBruta: 57.89,
  despesasPessoal: 2_500_00,
  prolabore: 500_00,
  despesasAdm: 300_00,
  despesasComerciais: 200_00,
  despesasTi: 150_00,
  despesasViagem: 100_00,
  despesasJuridicas: 80_00,
  despesasFinanceiras: 50_00,
  outrasDespesas: 20_00,
  outrasReceitasOp: 0,
  totalDespesasOp: 3_850_00,
  ebitda: 1_650_00,
  margemEbitda: 17.37,
  depreciacao: 0,
  amortizacao: 0,
  ebit: 1_650_00,
  margemOperacional: 17.37,
  receitaFinanceira: 0,
  resultadoFinanceiro: -50_00,
  resultadoAntesImpostos: 1_600_00,
  impostos: 400_00,
  lucroLiquido: 1_200_00,
  margemLiquida: 12.63,
  emprestimosEntrada: 0,
  amortizacaoDividas: 0,
  capex: 0,
  transferenciaInterna: 0,
  naoClassificado: 0,
};

const baseAnomalies: Anomaly[] = [
  {
    code: "MARGIN_DROP_HIGH",
    title: "Queda de margem bruta",
    description: "Margem bruta caiu 8pp vs trimestre anterior.",
    severity: "high",
    evidenceMetric: "dre:margemBruta",
    impactCents: -800_00,
  },
];

const baseCards: NarrativeCardDraft[] = [
  {
    type: "critical_gap",
    title: "Margem bruta crítica",
    body: "Custos diretos cresceram acima da receita; renegocie fornecedores principais.",
    evidenceRefs: ["dre:margemBruta", "anomaly:MARGIN_DROP_HIGH"],
  },
];

const baseMargin: MarginDiagnosis = {
  grossMarginStatus: "critical",
  operatingMarginStatus: "attention",
  mainDrivers: [
    {
      driver: "custo_fornecedor_principal",
      evidenceMetric: "dre:custosDiretos",
      impactCents: -500_00,
      severity: "high",
    },
  ],
};

const baseCashflow: CashflowRisk = {
  status: "critical",
  reasons: ["Saídas previstas superam saldo em 15 dias"],
  limitations: [],
};

function makeAction(overrides: Partial<ActionPlanItemDraft>): ActionPlanItemDraft {
  return {
    horizon: "short",
    title: "Renegociar fornecedor principal",
    description: "Reabrir contrato com fornecedor X buscando 10% de desconto e prazo +15d.",
    effortLevel: "low",
    riskLevel: "low",
    impactCents: 80_00,
    deadlineDays: 15,
    doneWhen: "Aditivo contratual assinado com redução >= R$ 800/mês visível em junho/2026.",
    evidenceRefs: ["anomaly:MARGIN_DROP_HIGH"],
    assumptions: [],
    confidence: 0.7,
    ...overrides,
  };
}

const validPayload = {
  actions: [
    makeAction({ horizon: "short", title: "Renegociar fornecedor principal" }),
    makeAction({ horizon: "short", title: "Acelerar cobrança de recebíveis vencidos", evidenceRefs: ["dre:margemBruta"] }),
    makeAction({ horizon: "short", title: "Cortar viagens não-essenciais", evidenceRefs: ["dre:despesasViagem"] }),
    makeAction({
      horizon: "medium",
      title: "Substituir fornecedor X por concorrente Y",
      deadlineDays: 60,
      evidenceRefs: ["driver:custo_fornecedor_principal"],
    }),
    makeAction({
      horizon: "long",
      title: "Verticalizar componente crítico",
      deadlineDays: 180,
      evidenceRefs: ["card:critical_gap:Margem bruta crítica"],
    }),
  ],
};

beforeEach(() => {
  callLlmMock.mockReset();
});

describe("action-planning agent prompts", () => {
  it("system prompt forces evidence citation and short bias under critical risk", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("evidenceRefs");
    expect(prompt).toContain("código de anomalia");
    expect(prompt).toContain("doneWhen");
    expect(prompt.toLowerCase()).toContain("short");
    // priorização: cashflow crítico OU anomalia high → favorecer SHORT
    expect(prompt).toMatch(/cashflowRisk\.status\s*==\s*"critical"/);
    expect(prompt).toMatch(/severity\s*==\s*"high"/);
  });

  it("system prompt raciocina como CFO: postura, alocação de capital, materialidade e proibições", () => {
    const prompt = buildSystemPrompt();
    // Passo 1 — postura financeira condiciona o foco (saudável → alocar; estressada → preservar)
    expect(prompt).toContain("POSTURA FINANCEIRA");
    expect(prompt).toContain("ALOCAÇÃO DE CAPITAL");
    expect(prompt).toContain("PRESERVAÇÃO DE CAIXA");
    expect(prompt).toMatch(/reserva de caixa|runway/i);
    expect(prompt).toMatch(/diversifica/i);
    // Passo 2 — gate de materialidade (não micro-otimização)
    expect(prompt).toContain("MATERIALIDADE");
    // Passo 3 — higiene de dados / classificar lançamentos não é ação de CFO
    expect(prompt.toLowerCase()).toContain("classificar lançamentos");
    // Passo 4 — raciocínio setorial via PERFIL DO NEGÓCIO inferido (segment costuma ser "geral")
    expect(prompt).toContain("PERFIL DO NEGÓCIO");
    // Anti-enchimento: não inventar 3ª short imaterial só para completar a cota
    expect(prompt).toMatch(/3ª ação short/);
    expect(prompt.toLowerCase()).toContain("micro-corte");
  });

  it("user prompt inclui o perfil do negócio inferido", () => {
    const userPrompt = buildUserPrompt({
      dre: baseDre,
      anomalies: baseAnomalies,
      narrativeCards: baseCards,
      marginDiagnosis: baseMargin,
      cashflowRisk: baseCashflow,
      referenceMonth: "2026-04",
      businessProfile: "Produtora de conteúdo jornalístico; receita-fim = assinaturas e publicidade.",
    });
    expect(userPrompt).toContain("Perfil do negócio");
    expect(userPrompt).toContain("conteúdo jornalístico");
  });

  it("system prompt inclui regra de ordenação ROI das ações short", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("ORDENAÇÃO DAS AÇÕES SHORT");
    expect(prompt).toContain("ROI");
    expect(prompt).toContain("effortScore");
    expect(prompt).toContain("impactCents");
  });

  it("user prompt includes DRE, anomalies, cards, margin and cashflow context", () => {
    const userPrompt = buildUserPrompt({
      dre: baseDre,
      anomalies: baseAnomalies,
      narrativeCards: baseCards,
      marginDiagnosis: baseMargin,
      cashflowRisk: baseCashflow,
      referenceMonth: "2026-04",
    });
    expect(userPrompt).toContain("DRE FACILITADO — 2026-04");
    expect(userPrompt).toContain("MARGIN_DROP_HIGH");
    expect(userPrompt).toContain("Margem bruta crítica");
    expect(userPrompt).toContain("custo_fornecedor_principal");
    expect(userPrompt).toContain("Saídas previstas superam saldo em 15 dias");
  });
});

describe("action-planning agent schema", () => {
  it("(a) accepts a valid payload with 3 short + 1 medium + 1 long", () => {
    expect(() => ActionPlanDraftSchema.parse(validPayload)).not.toThrow();
  });

  it("(b) rejects an action missing doneWhen", () => {
    const { doneWhen: _omit, ...rest } = makeAction({});
    const broken = {
      actions: [
        rest,
        ...validPayload.actions.slice(1),
      ],
    };
    expect(() => ActionPlanDraftSchema.parse(broken)).toThrow();
  });

  it("(c) rejects an action with empty evidenceRefs", () => {
    const broken = {
      actions: [
        makeAction({ evidenceRefs: [] }),
        ...validPayload.actions.slice(1),
      ],
    };
    expect(() => ActionPlanDraftSchema.parse(broken)).toThrow();
  });

  it("rejects when min horizons not met (no long action)", () => {
    const broken = {
      actions: validPayload.actions.map((a) =>
        a.horizon === "long" ? { ...a, horizon: "medium" as const } : a,
      ),
    };
    expect(() => ActionPlanDraftSchema.parse(broken)).toThrow();
  });
});

describe("sortShortsByRoi", () => {
  it("ordena shorts por ROI decrescente (impactCents / effortScore)", () => {
    const plan = {
      actions: [
        // ROI = 10000 / 3 ≈ 3333 — deve vir TERCEIRO
        makeAction({ horizon: "short", title: "C", impactCents: 10_000, effortLevel: "high" }),
        // ROI = 5000 / 1 = 5000 — deve vir PRIMEIRO
        makeAction({ horizon: "short", title: "A", impactCents: 5_000, effortLevel: "low" }),
        // ROI = 8000 / 2 = 4000 — deve vir SEGUNDO
        makeAction({ horizon: "short", title: "B", impactCents: 8_000, effortLevel: "medium" }),
        makeAction({ horizon: "medium", title: "D", impactCents: 20_000, effortLevel: "low" }),
        makeAction({ horizon: "long",   title: "E", impactCents: 50_000, effortLevel: "high" }),
      ],
    };
    const sorted = sortShortsByRoi(plan);
    const shortTitles = sorted.actions.filter((a) => a.horizon === "short").map((a) => a.title);
    expect(shortTitles).toEqual(["A", "B", "C"]);
  });

  it("desempata por riskLevel crescente (low < medium < high) quando ROI igual", () => {
    const plan = {
      actions: [
        // ROI = 6000/2 = 3000, riskLevel=high — deve vir SEGUNDO
        makeAction({ horizon: "short", title: "X", impactCents: 6_000, effortLevel: "medium", riskLevel: "high" }),
        // ROI = 6000/2 = 3000, riskLevel=low — deve vir PRIMEIRO
        makeAction({ horizon: "short", title: "Y", impactCents: 6_000, effortLevel: "medium", riskLevel: "low" }),
        // ROI = 6000/2 = 3000, riskLevel=medium — deve vir entre Y e X
        makeAction({ horizon: "short", title: "Z", impactCents: 6_000, effortLevel: "medium", riskLevel: "medium" }),
        makeAction({ horizon: "medium", title: "M", impactCents: 10_000 }),
        makeAction({ horizon: "long",   title: "L", impactCents: 30_000 }),
      ],
    };
    const sorted = sortShortsByRoi(plan);
    const shortTitles = sorted.actions.filter((a) => a.horizon === "short").map((a) => a.title);
    expect(shortTitles).toEqual(["Y", "Z", "X"]);
  });

  it("não altera a ordem de medium e long e reordena os shorts corretamente", () => {
    const plan = {
      actions: [
        makeAction({ horizon: "short", title: "S1", impactCents: 1_000, effortLevel: "low" }),
        makeAction({ horizon: "short", title: "S2", impactCents: 2_000, effortLevel: "low" }),
        makeAction({ horizon: "short", title: "S3", impactCents: 3_000, effortLevel: "low" }),
        makeAction({ horizon: "long",   title: "L1", impactCents: 50_000 }),
        makeAction({ horizon: "medium", title: "M1", impactCents: 20_000 }),
      ],
    };
    const sorted = sortShortsByRoi(plan);
    // Shorts reordenados por ROI desc: S3(ROI=3000) > S2(ROI=2000) > S1(ROI=1000)
    const shortTitles = sorted.actions.filter((a) => a.horizon === "short").map((a) => a.title);
    expect(shortTitles).toEqual(["S3", "S2", "S1"]);
    // L1 e M1 preservados na ordem original
    const nonShort = sorted.actions.filter((a) => a.horizon !== "short").map((a) => a.title);
    expect(nonShort).toEqual(["L1", "M1"]);
  });
});

describe("runActionPlanningAgent", () => {
  it("calls callLlm with task=action-planning, jsonMode and tenant context", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify(validPayload),
      provider: "google",
      model: "gemini-2.5-flash",
      inputTokens: 100,
      outputTokens: 200,
      costCents: 5,
      traceId: null,
    });

    const result = await runActionPlanningAgent(
      {
        dre: baseDre,
        anomalies: baseAnomalies,
        narrativeCards: baseCards,
        marginDiagnosis: baseMargin,
        cashflowRisk: baseCashflow,
        referenceMonth: "2026-04",
      },
      { tenantId: "tenant-1", traceId: "trace-9" },
    );

    expect(result.actions).toHaveLength(5);
    expect(result.actions.filter((a) => a.horizon === "short")).toHaveLength(3);
    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "action-planning",
      tenantId: "tenant-1",
      traceId: "trace-9",
      jsonMode: true,
    }));
    const request = callLlmMock.mock.calls[0]?.[0] as { systemPrompt: string; userPrompt: string };
    expect(request.systemPrompt).toContain("Plano de Ação");
    expect(request.userPrompt).toContain("MARGIN_DROP_HIGH");
  });

  it("propagates schema errors when LLM returns an action without doneWhen", async () => {
    const badPayload = {
      actions: [
        // missing doneWhen
        {
          horizon: "short",
          title: "Ação ruim",
          description: "Descrição mínima válida.",
          effortLevel: "low",
          riskLevel: "low",
          impactCents: 1000,
          deadlineDays: 7,
          evidenceRefs: ["dre:margemBruta"],
          assumptions: [],
          confidence: 0.5,
        },
        ...validPayload.actions.slice(1),
      ],
    };
    callLlmMock.mockResolvedValue({
      content: JSON.stringify(badPayload),
      provider: "google",
      model: "gemini-2.5-flash",
      inputTokens: 10,
      outputTokens: 10,
      costCents: 1,
      traceId: null,
    });

    await expect(runActionPlanningAgent(
      {
        dre: baseDre,
        anomalies: baseAnomalies,
        narrativeCards: baseCards,
        marginDiagnosis: baseMargin,
        cashflowRisk: baseCashflow,
      },
      { tenantId: "tenant-1" },
    )).rejects.toThrow();
  });
});
