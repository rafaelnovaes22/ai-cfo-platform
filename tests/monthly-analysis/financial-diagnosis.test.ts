import { describe, expect, it } from "vitest";

import type { DreLines } from "@/dre-narrative/aggregator.js";
import {
  assessCashflowRisk,
  detectFinancialAnomalies,
  diagnoseMargins,
  runAnomalyDetectionAgent,
  runCashflowRiskAgent,
  runMarginDiagnosisAgent,
} from "@/monthly-analysis/agents/index.js";
import { createInitialMonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import type { NormalizedLedgerEntry } from "@/monthly-analysis/schemas/agents.js";

function dre(overrides: Partial<DreLines> = {}): DreLines {
  const base: DreLines = {
    receitaBruta: 1_000_000,
    deducoes: 0,
    receitaLiquida: 1_000_000,
    custosDiretos: 400_000,
    lucroBruto: 600_000,
    margemBruta: 60,
    despesasPessoal: 150_000,
    prolabore: 50_000,
    despesasAdm: 50_000,
    despesasComerciais: 50_000,
    despesasTi: 20_000,
    despesasViagem: 0,
    despesasJuridicas: 0,
    despesasFinanceiras: 20_000,
    outrasDespesas: 0,
    outrasReceitasOp: 0,
    totalDespesasOp: 320_000,
    ebitda: 280_000,
    margemEbitda: 28,
    depreciacao: 0,
    amortizacao: 0,
    ebit: 280_000,
    margemOperacional: 28,
    receitaFinanceira: 0,
    resultadoFinanceiro: -20_000,
    resultadoAntesImpostos: 260_000,
    impostos: 60_000,
    lucroLiquido: 200_000,
    margemLiquida: 20,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
  };

  return { ...base, ...overrides };
}

function entry(id: string, date: string, direction: "in" | "out", amountCents: number): NormalizedLedgerEntry {
  return {
    entryId: id,
    date,
    description: id,
    normalizedDescription: id,
    amountCents,
    direction,
    documentType: "unknown",
    features: [],
    noiseFlags: [],
  };
}

describe("monthly-analysis financial diagnosis agents", () => {
  describe("detectFinancialAnomalies", () => {
    it("retorna saudável sem anomalias para DRE consistente", () => {
      expect(detectFinancialAnomalies({ dre: dre() })).toEqual([]);
    });

    it("marca atenção para margem operacional estreita", () => {
      const anomalies = detectFinancialAnomalies({ dre: dre({ margemOperacional: 3, ebit: 30_000, lucroLiquido: 20_000, margemLiquida: 2 }) });

      expect(anomalies).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "thin_operating_margin", severity: "medium" }),
      ]));
    });

    it("marca crítico para prejuízo e margem operacional negativa", () => {
      const anomalies = detectFinancialAnomalies({ dre: dre({
        ebit: -150_000,
        margemOperacional: -15,
        resultadoAntesImpostos: -180_000,
        lucroLiquido: -180_000,
        margemLiquida: -18,
      }) });

      expect(anomalies.some((item) => item.severity === "high")).toBe(true);
      expect(anomalies.map((item) => item.code)).toEqual(expect.arrayContaining(["net_loss_critical", "negative_operating_margin"]));
    });

    it("sinaliza dados insuficientes quando não há DRE utilizável", () => {
      const anomalies = detectFinancialAnomalies({ dre: dre({ receitaLiquida: 0 }) });

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0]).toEqual(expect.objectContaining({ code: "insufficient_data", severity: "low" }));
    });
  });

  describe("diagnoseMargins", () => {
    it("classifica margens saudáveis", () => {
      const diagnosis = diagnoseMargins(dre());

      expect(diagnosis.grossMarginStatus).toBe("healthy");
      expect(diagnosis.operatingMarginStatus).toBe("healthy");
      expect(diagnosis.mainDrivers[0]?.severity).toBe("low");
    });

    it("classifica atenção para margens intermediárias", () => {
      const diagnosis = diagnoseMargins(dre({ margemBruta: 35, custosDiretos: 650_000, margemOperacional: 8, ebit: 80_000 }));

      expect(diagnosis.grossMarginStatus).toBe("attention");
      expect(diagnosis.operatingMarginStatus).toBe("attention");
      expect(diagnosis.mainDrivers.every((driver) => driver.severity === "medium")).toBe(true);
    });

    it("classifica crítico para margem bruta e operacional baixas", () => {
      const diagnosis = diagnoseMargins(dre({ margemBruta: 18, custosDiretos: 820_000, margemOperacional: -2, ebit: -20_000 }));

      expect(diagnosis.grossMarginStatus).toBe("critical");
      expect(diagnosis.operatingMarginStatus).toBe("critical");
      expect(diagnosis.mainDrivers.some((driver) => driver.severity === "high")).toBe(true);
    });

    it("mantém contrato atual em caso de dados insuficientes", () => {
      const diagnosis = diagnoseMargins(undefined);

      expect(diagnosis).toEqual(expect.objectContaining({ grossMarginStatus: "critical", operatingMarginStatus: "critical" }));
      expect(diagnosis.mainDrivers[0]).toEqual(expect.objectContaining({ evidenceMetric: "receita_liquida<=0", severity: "high" }));
    });
  });

  describe("assessCashflowRisk", () => {
    it("classifica caixa saudável quando entradas cobrem saídas com folga", () => {
      const risk = assessCashflowRisk([
        entry("r1", "2026-05-01", "in", 500_000),
        entry("r2", "2026-05-02", "in", 500_000),
        entry("c1", "2026-05-03", "out", 200_000),
        entry("c2", "2026-05-04", "out", 150_000),
        entry("c3", "2026-05-05", "out", 100_000),
      ]);

      expect(risk.status).toBe("healthy");
      expect(risk.limitations).toEqual([]);
    });

    it("classifica atenção para baixa folga de caixa", () => {
      const risk = assessCashflowRisk([
        entry("r1", "2026-05-01", "in", 600_000),
        entry("r2", "2026-05-02", "in", 400_000),
        entry("c1", "2026-05-03", "out", 500_000),
        entry("c2", "2026-05-04", "out", 250_000),
        entry("c3", "2026-05-05", "out", 200_000),
      ]);

      expect(risk.status).toBe("attention");
      expect(risk.reasons[0]).toContain("Folga líquida baixa");
    });

    it("classifica crítico quando saídas superam entradas de forma relevante", () => {
      const risk = assessCashflowRisk([
        entry("r1", "2026-05-01", "in", 500_000),
        entry("r2", "2026-05-02", "in", 500_000),
        entry("c1", "2026-05-03", "out", 600_000),
        entry("c2", "2026-05-04", "out", 400_000),
        entry("c3", "2026-05-05", "out", 200_000),
      ]);

      expect(risk.status).toBe("critical");
      expect(risk.reasons[0]).toContain("Saídas superam entradas");
    });

    it("retorna insufficient_data para amostra pequena", () => {
      const risk = assessCashflowRisk([
        entry("r1", "2026-05-01", "in", 100_000),
      ]);

      expect(risk.status).toBe("insufficient_data");
      expect(risk.limitations[0]).toContain("mínimo=5");
    });
  });

  describe("state agents", () => {
    it("preenche saídas e traces sem custo de LLM", () => {
      const state = createInitialMonthlyAnalysisState({ analysisId: "analysis-1", tenantId: "tenant-1" });
      const withDre = { ...state, dre: dre(), normalizedEntries: [
        entry("r1", "2026-05-01", "in", 500_000),
        entry("r2", "2026-05-02", "in", 500_000),
        entry("c1", "2026-05-03", "out", 150_000),
        entry("c2", "2026-05-04", "out", 150_000),
        entry("c3", "2026-05-05", "out", 150_000),
      ] };

      const diagnosed = runCashflowRiskAgent(runMarginDiagnosisAgent(runAnomalyDetectionAgent(withDre)));

      expect(diagnosed.anomalies).toEqual([]);
      expect(diagnosed.marginDiagnosis?.grossMarginStatus).toBe("healthy");
      expect(diagnosed.cashflowRisk?.status).toBe("healthy");
      expect(diagnosed.costs).toEqual([]);
      expect(diagnosed.errors).toEqual([]);
      expect(diagnosed.traces.map((trace) => trace.agent)).toEqual(["anomaly-detection", "margin-diagnosis", "cashflow-risk"]);
      expect(diagnosed.traces.every((trace) => trace.schemaPassed)).toBe(true);
    });
  });
});

describe("people_cost_high — custo de pessoal", () => {
  it("dispara medium quando pessoal+prolabore >= 40% da receita líquida", () => {
    // 150k + 50k = 200k de 500k receita → 40%
    const anomalies = detectFinancialAnomalies({ dre: dre({ receitaLiquida: 500_000, receitaBruta: 500_000, despesasPessoal: 150_000, prolabore: 50_000 }) });
    expect(anomalies.some((a) => a.code === "people_cost_high" && a.severity === "medium")).toBe(true);
  });

  it("dispara high quando pessoal+prolabore >= 50% da receita líquida", () => {
    // 220k + 80k = 300k de 500k receita → 60%
    const anomalies = detectFinancialAnomalies({ dre: dre({ receitaLiquida: 500_000, receitaBruta: 500_000, despesasPessoal: 220_000, prolabore: 80_000 }) });
    expect(anomalies.some((a) => a.code === "people_cost_high" && a.severity === "high")).toBe(true);
  });

  it("não dispara quando pessoal+prolabore < 40% da receita líquida", () => {
    // base dre: 150k + 50k = 200k de 1_000_000 → 20%
    const anomalies = detectFinancialAnomalies({ dre: dre() });
    expect(anomalies.some((a) => a.code === "people_cost_high")).toBe(false);
  });
});

describe("leverage_ebitda_high — alavancagem financeira", () => {
  it("dispara medium quando despFinanceiras >= 30% do EBITDA", () => {
    // ebitda=100k, despFinanceiras=35k → 35%
    const anomalies = detectFinancialAnomalies({ dre: dre({ ebitda: 100_000, ebit: 100_000, margemEbitda: 10, despesasFinanceiras: 35_000 }) });
    expect(anomalies.some((a) => a.code === "leverage_ebitda_high" && a.severity === "medium")).toBe(true);
  });

  it("dispara high quando despFinanceiras >= 60% do EBITDA", () => {
    // ebitda=100k, despFinanceiras=65k → 65%
    const anomalies = detectFinancialAnomalies({ dre: dre({ ebitda: 100_000, ebit: 100_000, margemEbitda: 10, despesasFinanceiras: 65_000 }) });
    expect(anomalies.some((a) => a.code === "leverage_ebitda_high" && a.severity === "high")).toBe(true);
  });

  it("não dispara quando ebitda <= 0 (evita divisão por zero)", () => {
    const anomalies = detectFinancialAnomalies({ dre: dre({ ebitda: 0, ebit: 0, margemEbitda: 0, despesasFinanceiras: 50_000 }) });
    expect(anomalies.some((a) => a.code === "leverage_ebitda_high")).toBe(false);
  });

  it("não dispara quando despFinanceiras < 30% do EBITDA", () => {
    // base dre: ebitda=280k, despFinanceiras=20k → 7%
    const anomalies = detectFinancialAnomalies({ dre: dre() });
    expect(anomalies.some((a) => a.code === "leverage_ebitda_high")).toBe(false);
  });
});

describe("outflow_concentration_high — concentração de saída", () => {
  it("dispara medium quando um fornecedor >= 40% das saídas e saídas > 5% da receita", () => {
    // fornecedor "A" = 60k de 100k saídas totais → 60%; receita=500k → saídas=20%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 500_000 }),
      normalizedEntries: [
        entry("A", "2026-05-01", "out", 60_000),
        entry("A", "2026-05-02", "out", 60_000), // normalizedDescription="A" → 120k total
        entry("B", "2026-05-03", "out", 30_000),
        entry("C", "2026-05-04", "out", 30_000),
        entry("r1", "2026-05-01", "in", 500_000),
      ],
    });
    // A=120k de 240k total → 50%
    expect(anomalies.some((a) => a.code === "outflow_concentration_high" && a.severity === "medium")).toBe(true);
  });

  it("não dispara quando saídas totais são < 5% da receita (montante insignificante)", () => {
    // receita=1_000_000, saídas=40k = 4%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 1_000_000 }),
      normalizedEntries: [
        entry("A", "2026-05-01", "out", 30_000),
        entry("B", "2026-05-02", "out", 5_000),
        entry("C", "2026-05-03", "out", 5_000),
        entry("r1", "2026-05-01", "in", 1_000_000),
      ],
    });
    expect(anomalies.some((a) => a.code === "outflow_concentration_high")).toBe(false);
  });

  it("não dispara quando concentração < 40%", () => {
    // 3 fornecedores com saídas iguais → cada um = 33%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 500_000 }),
      normalizedEntries: [
        entry("A", "2026-05-01", "out", 100_000),
        entry("B", "2026-05-02", "out", 100_000),
        entry("C", "2026-05-03", "out", 100_000),
        entry("r1", "2026-05-01", "in", 500_000),
      ],
    });
    expect(anomalies.some((a) => a.code === "outflow_concentration_high")).toBe(false);
  });
});

describe("runway — saldo inicial de caixa", () => {
  // Entries helper: inflow=280k, outflow=300k → burn=20k/mês, burnRatio=7.1% → atenção base
  function burnEntries() {
    return [
      entry("r1", "2026-05-01", "in", 100_000),
      entry("r2", "2026-05-02", "in", 100_000),
      entry("r3", "2026-05-03", "in", 80_000),
      entry("c1", "2026-05-04", "out", 150_000),
      entry("c2", "2026-05-05", "out", 150_000),
    ];
  }

  it("eleva atenção para critical quando runway < 2 meses", () => {
    // burn=20k, openingBalance=30k → runway=1.5 → critical
    const risk = assessCashflowRisk(burnEntries(), { openingBalance: 30_000 });
    expect(risk.status).toBe("critical");
    expect(risk.reasons.some((r) => r.includes("Runway"))).toBe(true);
  });

  it("adiciona razão de atenção quando runway 2-4 meses sem alterar status", () => {
    // burn=20k, openingBalance=60k → runway=3 → permanece attention + razão
    const risk = assessCashflowRisk(burnEntries(), { openingBalance: 60_000 });
    expect(risk.status).toBe("attention");
    expect(risk.reasons.some((r) => r.includes("Runway"))).toBe(true);
  });

  it("não altera resultado quando runway >= 4 meses", () => {
    // burn=20k, openingBalance=200k → runway=10 → sem mudança
    const risk = assessCashflowRisk(burnEntries(), { openingBalance: 200_000 });
    expect(risk.status).toBe("attention");
    expect(risk.reasons.every((r) => !r.includes("Runway"))).toBe(true);
  });

  it("não altera resultado quando cashflow é positivo (sem burn)", () => {
    const risk = assessCashflowRisk([
      entry("r1", "2026-05-01", "in", 500_000),
      entry("r2", "2026-05-02", "in", 500_000),
      entry("c1", "2026-05-03", "out", 150_000),
      entry("c2", "2026-05-04", "out", 150_000),
      entry("c3", "2026-05-05", "out", 150_000),
    ], { openingBalance: 10_000 });
    expect(risk.status).toBe("healthy");
    expect(risk.reasons.every((r) => !r.includes("Runway"))).toBe(true);
  });

  it("adiciona limitação de runway quando openingBalance não informado e burn existe", () => {
    const risk = assessCashflowRisk(burnEntries());
    expect(risk.limitations.some((l) => l.includes("Saldo inicial"))).toBe(true);
  });
});

describe("MoM comparison — comparação mensal", () => {
  it("revenue_decline_mom high quando receita cai > 20%", () => {
    // -22%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 780_000, receitaBruta: 780_000 }),
      previousDre: dre({ receitaLiquida: 1_000_000, receitaBruta: 1_000_000 }),
    });
    expect(anomalies.some((a) => a.code === "revenue_decline_mom" && a.severity === "high")).toBe(true);
  });

  it("revenue_decline_mom medium quando receita cai 10-20%", () => {
    // -12%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 880_000, receitaBruta: 880_000 }),
      previousDre: dre({ receitaLiquida: 1_000_000, receitaBruta: 1_000_000 }),
    });
    expect(anomalies.some((a) => a.code === "revenue_decline_mom" && a.severity === "medium")).toBe(true);
  });

  it("não dispara revenue_decline_mom quando queda < 10%", () => {
    // -5%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ receitaLiquida: 950_000, receitaBruta: 950_000 }),
      previousDre: dre({ receitaLiquida: 1_000_000, receitaBruta: 1_000_000 }),
    });
    expect(anomalies.some((a) => a.code === "revenue_decline_mom")).toBe(false);
  });

  it("margin_deterioration_mom high quando margem bruta cai > 10pp", () => {
    // 60% → 45% = -15pp
    const anomalies = detectFinancialAnomalies({
      dre: dre({ margemBruta: 45, custosDiretos: 550_000, lucroBruto: 450_000 }),
      previousDre: dre({ margemBruta: 60, custosDiretos: 400_000, lucroBruto: 600_000 }),
    });
    expect(anomalies.some((a) => a.code === "margin_deterioration_mom" && a.severity === "high")).toBe(true);
  });

  it("margin_deterioration_mom medium quando margem bruta cai 5-10pp", () => {
    // 60% → 54% = -6pp
    const anomalies = detectFinancialAnomalies({
      dre: dre({ margemBruta: 54, custosDiretos: 460_000, lucroBruto: 540_000 }),
      previousDre: dre({ margemBruta: 60, custosDiretos: 400_000, lucroBruto: 600_000 }),
    });
    expect(anomalies.some((a) => a.code === "margin_deterioration_mom" && a.severity === "medium")).toBe(true);
  });

  it("expense_spike_mom medium quando despesas crescem > 25% sem crescimento de receita", () => {
    // base: totalDespesasOp=320k → current=420k → +31%; receita igual → 0%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ totalDespesasOp: 420_000 }),
      previousDre: dre(),
    });
    expect(anomalies.some((a) => a.code === "expense_spike_mom" && a.severity === "medium")).toBe(true);
  });

  it("expense_spike_mom high quando despesas crescem > 40% sem crescimento de receita", () => {
    // 320k → 460k = +43.75%
    const anomalies = detectFinancialAnomalies({
      dre: dre({ totalDespesasOp: 460_000 }),
      previousDre: dre(),
    });
    expect(anomalies.some((a) => a.code === "expense_spike_mom" && a.severity === "high")).toBe(true);
  });

  it("não dispara MoM quando não há DRE anterior", () => {
    const anomalies = detectFinancialAnomalies({ dre: dre() });
    const momCodes = ["revenue_decline_mom", "margin_deterioration_mom", "expense_spike_mom"];
    expect(anomalies.some((a) => momCodes.includes(a.code))).toBe(false);
  });
});

describe("SEGMENT_THRESHOLDS — thresholds por segmento", () => {
  // Cada teste verifica que um mesmo número de margem recebe diagnósticos
  // diferentes dependendo do segmento — garantindo que resolveThresholds funciona.

  it("varejo: margemBruta 20% é attention (healthy=30, attention=15)", () => {
    const result = diagnoseMargins(dre({ margemBruta: 20, custosDiretos: 800_000, lucroBruto: 200_000 }), "varejo");
    expect(result.grossMarginStatus).toBe("attention");
  });

  it("varejo: margemBruta 10% é critical (abaixo de attention=15)", () => {
    const result = diagnoseMargins(dre({ margemBruta: 10, custosDiretos: 900_000, lucroBruto: 100_000 }), "varejo");
    expect(result.grossMarginStatus).toBe("critical");
  });

  it("saas: margemBruta 50% é attention (healthy=65, attention=45)", () => {
    const result = diagnoseMargins(dre({ margemBruta: 50, custosDiretos: 500_000, lucroBruto: 500_000 }), "saas");
    expect(result.grossMarginStatus).toBe("attention");
  });

  it("saas: margemBruta 70% é healthy (acima de healthy=65)", () => {
    const result = diagnoseMargins(dre({ margemBruta: 70, custosDiretos: 300_000, lucroBruto: 700_000 }), "saas");
    expect(result.grossMarginStatus).toBe("healthy");
  });

  it("servicos-b2b: margemBruta 30% é critical (abaixo de attention=35)", () => {
    const result = diagnoseMargins(dre({ margemBruta: 30, custosDiretos: 700_000, lucroBruto: 300_000 }), "servicos-b2b");
    expect(result.grossMarginStatus).toBe("critical");
  });

  it("geral (fallback): margemBruta 35% é critical (abaixo de attention=30) — não, 35 > 30, é attention", () => {
    const result = diagnoseMargins(dre({ margemBruta: 35, custosDiretos: 650_000, lucroBruto: 350_000 }), "geral");
    // geral: healthy=50, attention=30 → 35 >= 30 mas < 50 → attention
    expect(result.grossMarginStatus).toBe("attention");
  });

  it("segmento desconhecido usa geral como fallback", () => {
    const resultUnknown = diagnoseMargins(dre({ margemBruta: 35 }), "segmento-inexistente");
    const resultGeral = diagnoseMargins(dre({ margemBruta: 35 }), "geral");
    expect(resultUnknown.grossMarginStatus).toBe(resultGeral.grossMarginStatus);
  });

  it("detectFinancialAnomalies usa threshold correto para varejo (netLossThreshold=0.05)", () => {
    // prejuízo de 6% da receita → high para varejo (threshold=0.05), mas attention para geral (threshold=0.10)
    const dreVarejo = dre({ lucroLiquido: -60_000, margemLiquida: -6, margemBruta: 40, custosDiretos: 600_000 });
    const anomaliesVarejo = detectFinancialAnomalies({ dre: dreVarejo, segment: "varejo" });
    const anomaliesGeral = detectFinancialAnomalies({ dre: dreVarejo, segment: "geral" });
    expect(anomaliesVarejo.some((a) => a.code === "net_loss_critical" && a.severity === "high")).toBe(true);
    expect(anomaliesGeral.some((a) => a.code === "net_loss_critical")).toBe(false);
  });
});
