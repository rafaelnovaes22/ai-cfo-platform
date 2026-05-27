import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { runFinancialQaReviewAgent, runDeterministicFinancialQaReview } from "@/monthly-analysis/agents/financial-qa-review.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/financial-qa-review.js";
import type {
  ActionPlanDraft,
  ActionPlanItemDraft,
  Anomaly,
  CashflowRisk,
  MarginDiagnosis,
  NarrativeCardDraft,
  QaReview,
} from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

beforeEach(() => {
  callLlmMock.mockReset();
});

function makeDre(overrides: Partial<DreLines> = {}): DreLines {
  return {
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
    ...overrides,
  };
}

const anomalies: Anomaly[] = [
  {
    code: "gross_margin_critical",
    title: "Margem bruta em nível crítico",
    description: "Margem bruta caiu para níveis críticos no mês.",
    severity: "high",
    evidenceMetric: "dre:margemBruta",
    impactCents: -800_00,
  },
];

const marginDiagnosis: MarginDiagnosis = {
  grossMarginStatus: "critical",
  operatingMarginStatus: "attention",
  mainDrivers: [
    {
      driver: "custos diretos pressionados por fornecedor principal",
      evidenceMetric: "dre:custosDiretos",
      impactCents: -500_00,
      severity: "high",
    },
  ],
};

const cashflowRisk: CashflowRisk = {
  status: "attention",
  reasons: ["Saídas previstas reduzem folga em 10 dias."],
  limitations: [],
};

function makeAction(overrides: Partial<ActionPlanItemDraft>): ActionPlanItemDraft {
  return {
    horizon: "short",
    title: "Renegociar fornecedor principal",
    description: "Reabrir contrato com fornecedor X buscando 10% de desconto.",
    effortLevel: "low",
    riskLevel: "low",
    impactCents: 80_00,
    deadlineDays: 15,
    doneWhen: "Aditivo contratual assinado com redução >= R$ 800/mês até 2026-07-01.",
    evidenceRefs: ["gross_margin_critical"],
    assumptions: [],
    confidence: 0.7,
    ...overrides,
  };
}

function coherentCards(): NarrativeCardDraft[] {
  return [
    {
      type: "critical_gap",
      title: "Margem bruta crítica pressiona resultado",
      body: "Margem bruta de 57,89% caiu por custos diretos. Renegocie contrato com fornecedor principal em 30 dias visando 10% de desconto.",
      evidenceRefs: ["margemBruta", "gross_margin_critical", "marginDiagnosis.grossMarginStatus=critical"],
    },
    {
      type: "attention",
      title: "Caixa com folga reduzida",
      body: "Folga de caixa caiu em 10 dias. Defina limite mínimo de saldo em R$ 50.000 e corte despesas administrativas em 15% até 2026-07-01.",
      evidenceRefs: ["cashflowRisk.status=attention", "despesasAdm"],
    },
    {
      type: "healthy",
      title: "EBITDA mantém ritmo",
      body: "EBITDA de R$ 16.500 com margem de 17,37% mostra operação sólida. Expanda lançando ofertas com mesmo mix.",
      evidenceRefs: ["ebitda", "margemEbitda"],
    },
  ];
}

function coherentPlan(): ActionPlanDraft {
  return {
    actions: [
      makeAction({ horizon: "short", title: "Renegociar fornecedor principal" }),
      makeAction({
        horizon: "short",
        title: "Acelerar cobrança",
        evidenceRefs: ["margemBruta"],
        doneWhen: "Recebimento de R$ 30.000 em recebíveis vencidos até 2026-06-30.",
      }),
      makeAction({
        horizon: "short",
        title: "Cortar despesa administrativa",
        evidenceRefs: ["despesasAdm"],
        doneWhen: "Despesa administrativa cai para R$ 25.500 em junho/2026.",
      }),
      makeAction({
        horizon: "medium",
        title: "Implementar política de compras",
        evidenceRefs: ["custosDiretos"],
        doneWhen: "Política publicada e 3 fornecedores recotados até 2026-09-30.",
      }),
      makeAction({
        horizon: "long",
        title: "Diversificar fornecedores",
        evidenceRefs: ["gross_margin_critical"],
        doneWhen: "Pelo menos 2 fornecedores alternativos homologados até 2026-12-31.",
      }),
    ],
  };
}

describe("buildSystemPrompt / buildUserPrompt (financial-qa-review)", () => {
  it("system prompt descreve papel + os 5 checks", () => {
    const sys = buildSystemPrompt();
    expect(sys).toMatch(/auditor financeiro/);
    expect(sys).toContain("NUMBER_MISMATCH");
    expect(sys).toContain("MISSING_DONEWHEN");
    expect(sys).toContain("CONTRADICTION");
    expect(sys).toContain("MISSING_EVIDENCE");
    expect(sys).toContain("UNFOUNDED_CLAIM");
    expect(sys).toMatch(/publishable/);
    expect(sys).toMatch(/retryTargets/);
  });

  it("user prompt injeta DRE + anomalias + diagnóstico + narrativa + plano", () => {
    const prompt = buildUserPrompt({
      dre: makeDre(),
      anomalies,
      marginDiagnosis,
      cashflowRisk,
      narrativeCards: coherentCards(),
      actionPlan: coherentPlan(),
      referenceMonth: "2026-04",
      segment: "tecnologia",
      taxRegime: "simples",
    });

    expect(prompt).toContain("DRE FACILITADO");
    expect(prompt).toContain("gross_margin_critical");
    expect(prompt).toContain("grossMarginStatus=critical");
    expect(prompt).toContain("status=attention");
    expect(prompt).toContain("[card#1 type=critical_gap]");
    expect(prompt).toContain("[action#1 horizon=short");
    expect(prompt).toContain("tecnologia");
    expect(prompt).toContain("simples");
  });
});

describe("runFinancialQaReviewAgent", () => {
  const baseState = {
    dre: makeDre(),
    anomalies,
    marginDiagnosis,
    cashflowRisk,
    narrativeCards: coherentCards(),
    actionPlan: coherentPlan(),
  };

  it("retorna blocker quando narrativa cita número errado da DRE (NUMBER_MISMATCH)", async () => {
    const mockReview: QaReview = {
      publishable: false,
      issues: [
        {
          severity: "blocker",
          code: "NUMBER_MISMATCH",
          message: "Card critical_gap cita 'lucro de R$ 50.000', mas DRE.lucroLiquido = R$ 12.000.",
          evidenceRef: "lucroLiquido",
        },
      ],
      retryTargets: ["narrative-synthesis"],
    };

    callLlmMock.mockResolvedValue({
      content: JSON.stringify(mockReview),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 600,
      outputTokens: 80,
      costCents: 2,
      traceId: null,
    });

    const result = await runFinancialQaReviewAgent(baseState, {
      tenantId: "tenant-1",
      traceId: "trace-qa-1",
      referenceMonth: "2026-04",
      segment: "tecnologia",
      taxRegime: "simples",
    });

    expect(result.publishable).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.severity).toBe("blocker");
    expect(result.issues[0]?.code).toBe("NUMBER_MISMATCH");
    expect(result.retryTargets).toEqual(["narrative-synthesis"]);

    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "financial-qa-review",
      tenantId: "tenant-1",
      traceId: "trace-qa-1",
      jsonMode: true,
    }));
  });

  it("retorna blocker quando ação não tem doneWhen mensurável (MISSING_DONEWHEN)", async () => {
    const mockReview: QaReview = {
      publishable: false,
      issues: [
        {
          severity: "blocker",
          code: "MISSING_DONEWHEN",
          message: "action#3 'Cortar despesa administrativa' tem doneWhen genérico ('cliente satisfeito') sem métrica nem prazo.",
          evidenceRef: "action#3",
        },
      ],
      retryTargets: ["action-planning"],
    };

    callLlmMock.mockResolvedValue({
      content: JSON.stringify(mockReview),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 600,
      outputTokens: 80,
      costCents: 2,
      traceId: null,
    });

    const result = await runFinancialQaReviewAgent(baseState, { tenantId: "tenant-1" });

    expect(result.publishable).toBe(false);
    expect(result.issues[0]?.code).toBe("MISSING_DONEWHEN");
    expect(result.retryTargets).toEqual(["action-planning"]);
  });

  it("retorna publishable=true quando análise está coerente", async () => {
    const mockReview: QaReview = {
      publishable: true,
      issues: [],
      retryTargets: [],
    };

    callLlmMock.mockResolvedValue({
      content: JSON.stringify(mockReview),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 600,
      outputTokens: 30,
      costCents: 2,
      traceId: null,
    });

    const result = await runFinancialQaReviewAgent(baseState, { tenantId: "tenant-1" });

    expect(result.publishable).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.retryTargets).toEqual([]);
  });

  it("falha rápido quando LLM devolve JSON malformado", async () => {
    callLlmMock.mockResolvedValue({
      content: "not-json{{",
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 600,
      outputTokens: 5,
      costCents: 2,
      traceId: null,
    });

    await expect(
      runFinancialQaReviewAgent(baseState, { tenantId: "tenant-1" }),
    ).rejects.toThrow();
  });

  it("falha rápido quando LLM devolve schema inválido (severity inexistente)", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify({
        publishable: false,
        issues: [
          { severity: "critical", code: "X", message: "Algo errado" },
        ],
        retryTargets: [],
      }),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 600,
      outputTokens: 30,
      costCents: 2,
      traceId: null,
    });

    await expect(
      runFinancialQaReviewAgent(baseState, { tenantId: "tenant-1" }),
    ).rejects.toThrow();
  });

  it("lança erro quando estado está incompleto (sem narrativeCards)", async () => {
    await expect(
      runFinancialQaReviewAgent(
        { ...baseState, narrativeCards: undefined },
        { tenantId: "tenant-1" },
      ),
    ).rejects.toThrow(/estado incompleto/);
    expect(callLlmMock).not.toHaveBeenCalled();
  });
});

describe("STAGE_MISMATCH — turnaround + expansão", () => {
  function turnaroundActions(expansionOverrides: Partial<ReturnType<typeof makeAction>>): ReturnType<typeof makeAction>[] {
    return [
      makeAction({ horizon: "short", ...expansionOverrides }),
      makeAction({ horizon: "short", title: "Cortar despesa adm", description: "Reduzir 15% dos custos administrativos em 30 dias.", doneWhen: "Despesa adm cai abaixo de R$ 2.500 até 2026-07-01.", evidenceRefs: ["dre:despesasAdm"] }),
      makeAction({ horizon: "short", title: "Cobrar recebíveis vencidos", description: "Ligar para 10 clientes inadimplentes esta semana.", doneWhen: "R$ 5.000 recuperados até 2026-07-01.", evidenceRefs: ["dre:receitaBruta"] }),
      makeAction({ horizon: "medium", title: "Renegociar dívida bancária", description: "Solicitar carência de 60 dias ao banco.", doneWhen: "Contrato renegociado com carência de 60 dias assinado até 2026-08-01.", evidenceRefs: ["dre:despesasFinanceiras"] }),
      makeAction({ horizon: "long", title: "Diversificar fornecedores", description: "Homologar 2 fornecedores alternativos.", doneWhen: "2 fornecedores alternativos homologados até 2026-12-31.", evidenceRefs: ["dre:custosDiretos"] }),
    ];
  }

  const turnaroundDre = makeDre({ lucroLiquido: -5_000_00, margemLiquida: -5.26 });
  const neutralDiagnosis: MarginDiagnosis = {
    grossMarginStatus: "attention",
    operatingMarginStatus: "attention",
    mainDrivers: [{ driver: "custos diretos", evidenceMetric: "dre:custosDiretos", impactCents: 50000, severity: "medium" }],
  };
  const neutralCashflow: CashflowRisk = { status: "attention", reasons: ["saídas altas"], limitations: [] };

  it("bloqueia ação de expandir canal em turnaround", () => {
    const state = {
      dre: turnaroundDre,
      anomalies: [],
      marginDiagnosis: neutralDiagnosis,
      cashflowRisk: neutralCashflow,
      narrativeCards: [],
      actionPlan: {
        actions: turnaroundActions({
          title: "Expandir canal digital",
          description: "Expandir presença em marketplace e redes sociais para aumentar vendas.",
          doneWhen: "Canal digital com 10 vendas registradas até 2026-07-31.",
          evidenceRefs: ["dre:receitaBruta"],
        }),
      },
    };

    const result = runDeterministicFinancialQaReview(state);
    expect(result.publishable).toBe(false);
    const issue = result.issues.find((i) => i.code === "STAGE_MISMATCH");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("blocker");
    expect(result.retryTargets).toContain("action-planning");
  });

  it("bloqueia ação de contratar equipe em turnaround", () => {
    const state = {
      dre: turnaroundDre,
      anomalies: [],
      marginDiagnosis: neutralDiagnosis,
      cashflowRisk: neutralCashflow,
      narrativeCards: [],
      actionPlan: {
        actions: turnaroundActions({
          title: "Contratar equipe de vendas",
          description: "Contratar vendedor sênior para aumentar carteira de clientes.",
          doneWhen: "Vendedor contratado e com 5 propostas enviadas até 2026-07-31.",
          evidenceRefs: ["dre:receitaBruta"],
        }),
      },
    };

    const result = runDeterministicFinancialQaReview(state);
    expect(result.publishable).toBe(false);
    expect(result.issues.some((i) => i.code === "STAGE_MISMATCH")).toBe(true);
  });

  it("não bloqueia ações de turnaround apropriadas mesmo com lucroLiquido < 0", () => {
    const state = {
      dre: turnaroundDre,
      anomalies: [],
      marginDiagnosis: neutralDiagnosis,
      cashflowRisk: neutralCashflow,
      narrativeCards: [],
      actionPlan: {
        actions: [
          makeAction({ horizon: "short", title: "Renegociar fornecedor principal", description: "Solicitar desconto de 10% no contrato atual.", doneWhen: "Redução de R$ 2.000/mês registrada na fatura de julho/2026.", evidenceRefs: ["dre:custosDiretos"] }),
          makeAction({ horizon: "short", title: "Cobrar recebíveis vencidos", description: "Ligar para 10 clientes inadimplentes esta semana.", doneWhen: "R$ 5.000 recuperados registrados até 2026-07-01.", evidenceRefs: ["dre:receitaBruta"] }),
          makeAction({ horizon: "short", title: "Cortar despesas de viagem", description: "Cancelar 3 viagens não essenciais agendadas para o trimestre.", doneWhen: "Despesa de viagem cai abaixo de R$ 1.000 até 2026-07-31.", evidenceRefs: ["dre:despesasViagem"] }),
          makeAction({ horizon: "medium", title: "Renegociar dívida bancária", description: "Solicitar carência de 60 dias ao banco principal.", doneWhen: "Contrato renegociado com carência aprovada até 2026-08-01.", evidenceRefs: ["dre:despesasFinanceiras"] }),
          makeAction({ horizon: "long", title: "Diversificar fornecedores", description: "Homologar 2 fornecedores alternativos ao principal.", doneWhen: "2 fornecedores homologados até 2026-12-31.", evidenceRefs: ["dre:custosDiretos"] }),
        ],
      },
    };

    const result = runDeterministicFinancialQaReview(state);
    expect(result.issues.filter((i) => i.code === "STAGE_MISMATCH")).toHaveLength(0);
  });

  it("não bloqueia expansão quando empresa é lucrativa", () => {
    const state = {
      dre: makeDre({ lucroLiquido: 1_200_00, margemLiquida: 12.63 }),
      anomalies: [],
      marginDiagnosis: { grossMarginStatus: "healthy" as const, operatingMarginStatus: "healthy" as const, mainDrivers: [{ driver: "margens saudáveis", evidenceMetric: "dre:margemBruta", impactCents: 0, severity: "low" as const }] },
      cashflowRisk: { status: "healthy" as const, reasons: ["folga positiva"], limitations: [] },
      narrativeCards: [],
      actionPlan: {
        actions: [
          makeAction({ horizon: "short", title: "Expandir canal digital", description: "Lançar novo canal de venda online com meta de 20 pedidos/mês.", doneWhen: "Canal com 20 pedidos registrados em 30 dias.", evidenceRefs: ["dre:receitaBruta"] }),
          makeAction({ horizon: "short", title: "Contratar vendedor sênior", description: "Contratar vendedor para expandir carteira.", doneWhen: "Vendedor contratado e meta de 5 propostas enviadas até 2026-07-31.", evidenceRefs: ["dre:receitaBruta"] }),
          makeAction({ horizon: "short", title: "Aumentar marketing digital", description: "Aumentar verba de marketing em R$ 2.000/mês.", doneWhen: "Verba aprovada e campanha publicada até 2026-07-15.", evidenceRefs: ["dre:despesasComerciais"] }),
          makeAction({ horizon: "medium", title: "Lançar novo produto", description: "Lançar nova linha de serviço premium.", doneWhen: "Produto homologado e 2 contratos assinados até 2026-09-30.", evidenceRefs: ["dre:receitaBruta"] }),
          makeAction({ horizon: "long", title: "Abrir filial em Campinas", description: "Abrir nova unidade para ampliar mercado geográfico.", doneWhen: "Filial com CNPJ registrado e 5 clientes até 2026-12-31.", evidenceRefs: ["dre:receitaBruta"] }),
        ],
      },
    };

    const result = runDeterministicFinancialQaReview(state);
    expect(result.issues.filter((i) => i.code === "STAGE_MISMATCH")).toHaveLength(0);
  });
});
