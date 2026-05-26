import { createHash } from "node:crypto";

import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import {
  AnomalySchema,
  CashflowRiskSchema,
  MarginDiagnosisSchema,
  type AgentName,
  type AgentSeverity,
  type Anomaly,
  type CashflowRisk,
  type MarginDiagnosis,
  type NormalizedLedgerEntry,
} from "@/monthly-analysis/schemas/agents.js";

const MIN_CASHFLOW_ENTRIES = 5;
const MIN_CASHFLOW_DISTINCT_DAYS = 3;

type MarginStatus = MarginDiagnosis["grossMarginStatus"];

type Driver = MarginDiagnosis["mainDrivers"][number];

// Espelha o enum industrySegment do schema Prisma (C8: nenhuma chave fora deste union é válida).
export type IndustrySegment = "varejo" | "industria-leve" | "servicos-b2b" | "saas" | "agencia" | "geral";

interface SegmentThresholds {
  gross: { healthy: number; attention: number };
  operating: { healthy: number; attention: number };
  netLossThreshold: number; // ratio prejuízo/receita que aciona severidade "high"
}

const SEGMENT_THRESHOLDS: Record<IndustrySegment, SegmentThresholds> = {
  varejo:           { gross: { healthy: 30, attention: 15 }, operating: { healthy: 8,  attention: 2  }, netLossThreshold: 0.05 },
  "industria-leve": { gross: { healthy: 35, attention: 20 }, operating: { healthy: 10, attention: 3  }, netLossThreshold: 0.08 },
  "servicos-b2b":   { gross: { healthy: 55, attention: 35 }, operating: { healthy: 15, attention: 5  }, netLossThreshold: 0.10 },
  saas:             { gross: { healthy: 65, attention: 45 }, operating: { healthy: 20, attention: 8  }, netLossThreshold: 0.10 },
  agencia:          { gross: { healthy: 50, attention: 30 }, operating: { healthy: 12, attention: 4  }, netLossThreshold: 0.08 },
  geral:            { gross: { healthy: 50, attention: 30 }, operating: { healthy: 15, attention: 5  }, netLossThreshold: 0.10 },
};

function resolveThresholds(segment?: string): SegmentThresholds {
  return SEGMENT_THRESHOLDS[segment as IndustrySegment] ?? SEGMENT_THRESHOLDS.geral;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function statusFromMargin(value: number, thresholds: { healthy: number; attention: number }): MarginStatus {
  if (value >= thresholds.healthy) return "healthy";
  if (value >= thresholds.attention) return "attention";
  return "critical";
}

function severityFromStatus(status: MarginStatus): AgentSeverity {
  if (status === "critical") return "high";
  if (status === "attention") return "medium";
  return "low";
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function topOperatingExpense(dre: DreLines): { label: string; amountCents: number } {
  const expenses = [
    { label: "despesas com pessoal", amountCents: dre.despesasPessoal },
    { label: "pró-labore", amountCents: dre.prolabore },
    { label: "despesas administrativas", amountCents: dre.despesasAdm },
    { label: "despesas comerciais", amountCents: dre.despesasComerciais },
    { label: "TI e tecnologia", amountCents: dre.despesasTi },
    { label: "viagens", amountCents: dre.despesasViagem },
    { label: "jurídico/contábil", amountCents: dre.despesasJuridicas },
    { label: "outras despesas", amountCents: dre.outrasDespesas },
  ];

  return expenses.reduce((biggest, current) => current.amountCents > biggest.amountCents ? current : biggest, expenses[0]!);
}

function anomaly(code: string, title: string, description: string, severity: AgentSeverity, evidenceMetric: string, impactCents?: number): Anomaly {
  return AnomalySchema.parse({ code, title, description, severity, evidenceMetric, impactCents });
}

export function detectFinancialAnomalies(input: {
  dre?: DreLines;
  normalizedEntries?: NormalizedLedgerEntry[];
  segment?: string;
  previousDre?: DreLines;
}): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { dre, normalizedEntries = [], segment, previousDre } = input;
  const thresholds = resolveThresholds(segment);

  if (!dre || dre.receitaLiquida <= 0) {
    return [
      anomaly(
        "insufficient_data",
        "Dados insuficientes para anomalias",
        "Não há DRE com receita líquida positiva suficiente para avaliar anomalias financeiras com segurança.",
        "low",
        "receita_liquida<=0",
      ),
    ];
  }

  const revenue = dre.receitaLiquida;
  const netLossRatio = safeRatio(Math.abs(Math.min(dre.lucroLiquido, 0)), revenue);
  const unclassifiedRatio = safeRatio(dre.naoClassificado, revenue);
  const financeExpenseRatio = safeRatio(dre.despesasFinanceiras, revenue);

  if (dre.lucroLiquido < 0 && netLossRatio >= thresholds.netLossThreshold) {
    anomalies.push(anomaly(
      "net_loss_critical",
      "Prejuízo líquido relevante",
      `O mês fechou com prejuízo líquido de ${money(Math.abs(dre.lucroLiquido))}, equivalente a ${(netLossRatio * 100).toFixed(2)}% da receita líquida.`,
      "high",
      `lucro_liquido=${money(dre.lucroLiquido)}; margem_liquida=${pct(dre.margemLiquida)}`,
      Math.abs(dre.lucroLiquido),
    ));
  }

  if (dre.margemOperacional < 0) {
    anomalies.push(anomaly(
      "negative_operating_margin",
      "Margem operacional negativa",
      `A operação consumiu caixa antes do resultado financeiro, com margem operacional de ${pct(dre.margemOperacional)}.`,
      "high",
      `margem_operacional=${pct(dre.margemOperacional)}; ebit=${money(dre.ebit)}`,
      Math.abs(Math.min(dre.ebit, 0)),
    ));
  } else if (dre.margemOperacional < thresholds.operating.attention) {
    anomalies.push(anomaly(
      "thin_operating_margin",
      "Margem operacional estreita",
      `A margem operacional de ${pct(dre.margemOperacional)} está abaixo do mínimo esperado para este segmento (${thresholds.operating.attention}%), deixando pouca folga para impostos e oscilações.`,
      "medium",
      `margem_operacional=${pct(dre.margemOperacional)}`,
    ));
  }

  if (dre.margemBruta < thresholds.gross.attention) {
    anomalies.push(anomaly(
      "gross_margin_critical",
      "Margem bruta crítica",
      `Custos diretos consomem a maior parte da receita; margem bruta atual é ${pct(dre.margemBruta)}, abaixo do mínimo de ${thresholds.gross.attention}% esperado para este segmento.`,
      "high",
      `margem_bruta=${pct(dre.margemBruta)}; custos_diretos=${money(dre.custosDiretos)}`,
      Math.max(0, dre.custosDiretos - Math.round(revenue * (1 - thresholds.gross.attention / 100))),
    ));
  } else if (dre.margemBruta < thresholds.gross.healthy) {
    anomalies.push(anomaly(
      "gross_margin_attention",
      "Margem bruta em atenção",
      `A margem bruta de ${pct(dre.margemBruta)} está abaixo da referência saudável de ${thresholds.gross.healthy}% para este segmento, sugerindo pressão de custos ou precificação.`,
      "medium",
      `margem_bruta=${pct(dre.margemBruta)}`,
    ));
  }

  const peopleCostRatio = safeRatio(dre.despesasPessoal + dre.prolabore, revenue);
  if (peopleCostRatio >= 0.5) {
    anomalies.push(anomaly(
      "people_cost_high",
      "Custo de pessoal crítico",
      `Pessoal + pró-labore somam ${money(dre.despesasPessoal + dre.prolabore)}, equivalente a ${(peopleCostRatio * 100).toFixed(2)}% da receita líquida — alto demais para sustentar margens.`,
      "high",
      `despesasPessoal=${money(dre.despesasPessoal)}; prolabore=${money(dre.prolabore)}; receita_liquida=${money(revenue)}`,
      dre.despesasPessoal + dre.prolabore,
    ));
  } else if (peopleCostRatio >= 0.4) {
    anomalies.push(anomaly(
      "people_cost_high",
      "Custo de pessoal elevado",
      `Pessoal + pró-labore somam ${money(dre.despesasPessoal + dre.prolabore)}, representando ${(peopleCostRatio * 100).toFixed(2)}% da receita líquida.`,
      "medium",
      `despesasPessoal=${money(dre.despesasPessoal)}; prolabore=${money(dre.prolabore)}; receita_liquida=${money(revenue)}`,
      dre.despesasPessoal + dre.prolabore,
    ));
  }

  if (unclassifiedRatio >= 0.15) {
    anomalies.push(anomaly(
      "unclassified_volume_high",
      "Volume alto sem classificação",
      `Lançamentos não classificados equivalem a ${(unclassifiedRatio * 100).toFixed(2)}% da receita líquida, reduzindo confiabilidade da leitura.`,
      "high",
      `nao_classificado=${money(dre.naoClassificado)}; receita_liquida=${money(revenue)}`,
      dre.naoClassificado,
    ));
  } else if (unclassifiedRatio >= 0.05) {
    anomalies.push(anomaly(
      "unclassified_volume_attention",
      "Classificação incompleta relevante",
      `Lançamentos não classificados equivalem a ${(unclassifiedRatio * 100).toFixed(2)}% da receita líquida.`,
      "medium",
      `nao_classificado=${money(dre.naoClassificado)}; receita_liquida=${money(revenue)}`,
      dre.naoClassificado,
    ));
  }

  if (financeExpenseRatio >= 0.1) {
    anomalies.push(anomaly(
      "financial_expenses_high",
      "Despesa financeira elevada",
      `Despesas financeiras somam ${money(dre.despesasFinanceiras)}, ${(financeExpenseRatio * 100).toFixed(2)}% da receita líquida.`,
      "medium",
      `despesas_financeiras=${money(dre.despesasFinanceiras)}; receita_liquida=${money(revenue)}`,
      dre.despesasFinanceiras,
    ));
  }

  const leverageRatio = safeRatio(dre.despesasFinanceiras, dre.ebitda);
  if (dre.ebitda > 0) {
    if (leverageRatio >= 0.6) {
      anomalies.push(anomaly(
        "leverage_ebitda_high",
        "Alavancagem financeira crítica",
        `Despesas financeiras de ${money(dre.despesasFinanceiras)} consomem ${(leverageRatio * 100).toFixed(2)}% do EBITDA (${money(dre.ebitda)}), indicando pressão de dívida acima do sustentável.`,
        "high",
        `despesas_financeiras=${money(dre.despesasFinanceiras)}; ebitda=${money(dre.ebitda)}`,
        dre.despesasFinanceiras,
      ));
    } else if (leverageRatio >= 0.3) {
      anomalies.push(anomaly(
        "leverage_ebitda_high",
        "Alavancagem financeira elevada",
        `Despesas financeiras de ${money(dre.despesasFinanceiras)} consomem ${(leverageRatio * 100).toFixed(2)}% do EBITDA (${money(dre.ebitda)}).`,
        "medium",
        `despesas_financeiras=${money(dre.despesasFinanceiras)}; ebitda=${money(dre.ebitda)}`,
        dre.despesasFinanceiras,
      ));
    }
  }

  const largestOutflow = normalizedEntries
    .filter((entry) => entry.direction === "out")
    .reduce<NormalizedLedgerEntry | undefined>((largest, entry) => {
      if (!largest) return entry;
      return Math.abs(entry.amountCents) > Math.abs(largest.amountCents) ? entry : largest;
    }, undefined);

  if (largestOutflow && Math.abs(largestOutflow.amountCents) >= revenue * 0.25) {
    anomalies.push(anomaly(
      "single_large_outflow",
      "Saída individual concentrada",
      `Um único lançamento de saída representa pelo menos 25% da receita líquida do mês: ${largestOutflow.normalizedDescription}.`,
      "medium",
      `maior_saida=${money(Math.abs(largestOutflow.amountCents))}; receita_liquida=${money(revenue)}`,
      Math.abs(largestOutflow.amountCents),
    ));
  }

  const outflowEntries = normalizedEntries.filter((e) => e.direction === "out");
  const totalOutflow = outflowEntries.reduce((sum, e) => sum + Math.abs(e.amountCents), 0);
  if (outflowEntries.length > 0 && totalOutflow > revenue * 0.05) {
    const byDescription = new Map<string, number>();
    for (const e of outflowEntries) {
      byDescription.set(e.normalizedDescription, (byDescription.get(e.normalizedDescription) ?? 0) + Math.abs(e.amountCents));
    }
    const topEntry = [...byDescription.entries()].reduce<[string, number] | undefined>(
      (biggest, current) => (!biggest || current[1] > biggest[1] ? current : biggest),
      undefined,
    );
    if (topEntry) {
      const concentrationRatio = safeRatio(topEntry[1], totalOutflow);
      if (concentrationRatio >= 0.4) {
        anomalies.push(anomaly(
          "outflow_concentration_high",
          "Saída concentrada em fornecedor único",
          `"${topEntry[0]}" representa ${(concentrationRatio * 100).toFixed(2)}% das saídas do período (${money(topEntry[1])} de ${money(totalOutflow)} em saídas).`,
          "medium",
          `fornecedor=${topEntry[0]}; concentracao=${(concentrationRatio * 100).toFixed(2)}%; total_saidas=${money(totalOutflow)}`,
          topEntry[1],
        ));
      }
    }
  }

  if (previousDre && previousDre.receitaLiquida > 0) {
    const prevRevenue = previousDre.receitaLiquida;
    const revenueChange = (revenue - prevRevenue) / prevRevenue;

    if (revenueChange <= -0.20) {
      anomalies.push(anomaly(
        "revenue_decline_mom",
        "Queda de receita relevante vs mês anterior",
        `Receita líquida caiu ${Math.abs(revenueChange * 100).toFixed(1)}% em relação ao mês anterior (${money(prevRevenue)} → ${money(revenue)}).`,
        "high",
        `receita_liquida=${money(revenue)}; receita_anterior=${money(prevRevenue)}; variacao=${(revenueChange * 100).toFixed(1)}%`,
        Math.abs(revenue - prevRevenue),
      ));
    } else if (revenueChange <= -0.10) {
      anomalies.push(anomaly(
        "revenue_decline_mom",
        "Queda de receita vs mês anterior",
        `Receita líquida caiu ${Math.abs(revenueChange * 100).toFixed(1)}% em relação ao mês anterior (${money(prevRevenue)} → ${money(revenue)}).`,
        "medium",
        `receita_liquida=${money(revenue)}; receita_anterior=${money(prevRevenue)}; variacao=${(revenueChange * 100).toFixed(1)}%`,
        Math.abs(revenue - prevRevenue),
      ));
    }

    const marginChangePp = dre.margemBruta - previousDre.margemBruta;
    if (marginChangePp <= -10) {
      anomalies.push(anomaly(
        "margin_deterioration_mom",
        "Queda acentuada de margem bruta vs mês anterior",
        `Margem bruta caiu ${Math.abs(marginChangePp).toFixed(1)}pp em relação ao mês anterior (${pct(previousDre.margemBruta)} → ${pct(dre.margemBruta)}).`,
        "high",
        `margem_bruta=${pct(dre.margemBruta)}; margem_anterior=${pct(previousDre.margemBruta)}; queda=${Math.abs(marginChangePp).toFixed(1)}pp`,
        Math.abs(dre.custosDiretos - previousDre.custosDiretos),
      ));
    } else if (marginChangePp <= -5) {
      anomalies.push(anomaly(
        "margin_deterioration_mom",
        "Queda de margem bruta vs mês anterior",
        `Margem bruta caiu ${Math.abs(marginChangePp).toFixed(1)}pp em relação ao mês anterior (${pct(previousDre.margemBruta)} → ${pct(dre.margemBruta)}).`,
        "medium",
        `margem_bruta=${pct(dre.margemBruta)}; margem_anterior=${pct(previousDre.margemBruta)}; queda=${Math.abs(marginChangePp).toFixed(1)}pp`,
      ));
    }

    if (previousDre.totalDespesasOp > 0) {
      const expenseChange = (dre.totalDespesasOp - previousDre.totalDespesasOp) / previousDre.totalDespesasOp;
      if (expenseChange >= 0.40 && revenueChange < 0.05) {
        anomalies.push(anomaly(
          "expense_spike_mom",
          "Salto expressivo de despesas operacionais vs mês anterior",
          `Despesas operacionais cresceram ${(expenseChange * 100).toFixed(1)}% vs mês anterior (${money(previousDre.totalDespesasOp)} → ${money(dre.totalDespesasOp)}) sem crescimento equivalente de receita.`,
          "high",
          `totalDespesasOp=${money(dre.totalDespesasOp)}; despesas_anteriores=${money(previousDre.totalDespesasOp)}; variacao=${(expenseChange * 100).toFixed(1)}%`,
          dre.totalDespesasOp - previousDre.totalDespesasOp,
        ));
      } else if (expenseChange >= 0.25 && revenueChange < 0.05) {
        anomalies.push(anomaly(
          "expense_spike_mom",
          "Crescimento de despesas operacionais vs mês anterior",
          `Despesas operacionais cresceram ${(expenseChange * 100).toFixed(1)}% vs mês anterior (${money(previousDre.totalDespesasOp)} → ${money(dre.totalDespesasOp)}) sem crescimento equivalente de receita.`,
          "medium",
          `totalDespesasOp=${money(dre.totalDespesasOp)}; despesas_anteriores=${money(previousDre.totalDespesasOp)}; variacao=${(expenseChange * 100).toFixed(1)}%`,
          dre.totalDespesasOp - previousDre.totalDespesasOp,
        ));
      }
    }
  }

  return anomalies;
}

export function diagnoseMargins(dre?: DreLines, segment?: string): MarginDiagnosis {
  if (!dre || dre.receitaLiquida <= 0) {
    return MarginDiagnosisSchema.parse({
      grossMarginStatus: "critical",
      operatingMarginStatus: "critical",
      mainDrivers: [{
        driver: "Dados insuficientes para diagnóstico de margem",
        evidenceMetric: "receita_liquida<=0",
        impactCents: 0,
        severity: "high",
      }],
    });
  }

  const thresholds = resolveThresholds(segment);
  const grossMarginStatus = statusFromMargin(dre.margemBruta, thresholds.gross);
  const operatingMarginStatus = statusFromMargin(dre.margemOperacional, thresholds.operating);
  const drivers: Driver[] = [];

  if (grossMarginStatus !== "healthy") {
    // targetCostRatio: percentual máximo de custos diretos sobre receita líquida para o segmento
    const targetGrossMargin = grossMarginStatus === "critical" ? thresholds.gross.attention : thresholds.gross.healthy;
    const targetCostRatio = (100 - targetGrossMargin) / 100;
    drivers.push({
      driver: "Custos diretos pressionam a margem bruta",
      evidenceMetric: `margem_bruta=${pct(dre.margemBruta)}; custos_diretos=${money(dre.custosDiretos)}`,
      impactCents: Math.max(0, dre.custosDiretos - Math.round(dre.receitaLiquida * targetCostRatio)),
      severity: severityFromStatus(grossMarginStatus),
    });
  }

  if (operatingMarginStatus !== "healthy") {
    const topExpense = topOperatingExpense(dre);
    drivers.push({
      driver: `Despesa operacional dominante: ${topExpense.label}`,
      evidenceMetric: `margem_operacional=${pct(dre.margemOperacional)}; ${topExpense.label}=${money(topExpense.amountCents)}`,
      impactCents: topExpense.amountCents,
      severity: severityFromStatus(operatingMarginStatus),
    });
  }

  if (drivers.length === 0) {
    drivers.push({
      driver: "Margens bruta e operacional saudáveis no período",
      evidenceMetric: `margem_bruta=${pct(dre.margemBruta)}; margem_operacional=${pct(dre.margemOperacional)}`,
      impactCents: 0,
      severity: "low",
    });
  }

  return MarginDiagnosisSchema.parse({ grossMarginStatus, operatingMarginStatus, mainDrivers: drivers });
}

function applyRunway(result: CashflowRisk, inflow: number, outflow: number, openingBalance?: number): CashflowRisk {
  const monthlyBurn = outflow - inflow;

  if (openingBalance === undefined) {
    if (monthlyBurn > 0) {
      return CashflowRiskSchema.parse({
        ...result,
        limitations: [...result.limitations, "Saldo inicial de caixa não informado — runway não calculado."],
      });
    }
    return result;
  }

  if (monthlyBurn <= 0) return result;

  const runwayMonths = openingBalance / monthlyBurn;
  if (runwayMonths < 2) {
    return CashflowRiskSchema.parse({
      status: "critical",
      reasons: [...result.reasons, `Runway estimado em ${runwayMonths.toFixed(1)} mês(es) com o ritmo atual de consumo.`],
      limitations: result.limitations,
    });
  }
  if (runwayMonths < 4) {
    return CashflowRiskSchema.parse({
      status: result.status === "healthy" ? "attention" : result.status,
      reasons: [...result.reasons, `Runway de caixa estimado em ${runwayMonths.toFixed(1)} meses — reserva abaixo de 4 meses.`],
      limitations: result.limitations,
    });
  }
  return result;
}

export function assessCashflowRisk(entries?: NormalizedLedgerEntry[], options?: { openingBalance?: number }): CashflowRisk {
  const openingBalance = options?.openingBalance;

  if (!entries || entries.length < MIN_CASHFLOW_ENTRIES) {
    return CashflowRiskSchema.parse({
      status: "insufficient_data",
      reasons: ["Amostra pequena demais para avaliar risco de caixa."],
      limitations: [`mínimo=${MIN_CASHFLOW_ENTRIES} lançamentos; recebido=${entries?.length ?? 0}`],
    });
  }

  const validEntries = entries.filter((entry) => !Number.isNaN(Date.parse(entry.date)));
  const distinctDays = new Set(validEntries.map((entry) => entry.date.slice(0, 10))).size;

  if (validEntries.length < MIN_CASHFLOW_ENTRIES || distinctDays < MIN_CASHFLOW_DISTINCT_DAYS) {
    return CashflowRiskSchema.parse({
      status: "insufficient_data",
      reasons: ["Datas insuficientes para observar distribuição de entradas e saídas."],
      limitations: [`dias_distintos=${distinctDays}; mínimo=${MIN_CASHFLOW_DISTINCT_DAYS}`],
    });
  }

  const inflow = validEntries
    .filter((entry) => entry.direction === "in")
    .reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0);
  const outflow = validEntries
    .filter((entry) => entry.direction === "out")
    .reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0);
  const netCashflow = inflow - outflow;
  const burnRatio = safeRatio(outflow - inflow, inflow);
  const netMargin = safeRatio(netCashflow, inflow);
  const topInflow = validEntries
    .filter((entry) => entry.direction === "in")
    .reduce((largest, entry) => Math.max(largest, Math.abs(entry.amountCents)), 0);
  const inflowConcentration = safeRatio(topInflow, inflow);

  let baseResult: CashflowRisk;

  if (inflow <= 0) {
    baseResult = CashflowRiskSchema.parse({
      status: "critical",
      reasons: ["Não há entradas registradas no período, mas existem saídas de caixa."],
      limitations: [],
    });
  } else if (netCashflow < 0 && burnRatio >= 0.15) {
    baseResult = CashflowRiskSchema.parse({
      status: "critical",
      reasons: [`Saídas superam entradas em ${(burnRatio * 100).toFixed(2)}% (${money(Math.abs(netCashflow))}).`],
      limitations: [],
    });
  } else if (netCashflow < 0 || netMargin < 0.1 || inflowConcentration >= 0.7) {
    const reasons = [
      netCashflow < 0
        ? `Fluxo de caixa líquido negativo em ${money(Math.abs(netCashflow))}.`
        : `Folga líquida baixa: ${(netMargin * 100).toFixed(2)}% das entradas.`,
    ];
    if (inflowConcentration >= 0.7) {
      reasons.push(`Entrada mais relevante concentra ${(inflowConcentration * 100).toFixed(2)}% das entradas.`);
    }
    baseResult = CashflowRiskSchema.parse({ status: "attention", reasons, limitations: [] });
  } else {
    baseResult = CashflowRiskSchema.parse({
      status: "healthy",
      reasons: [`Entradas cobrem saídas com folga líquida de ${(netMargin * 100).toFixed(2)}%.`],
      limitations: [],
    });
  }

  return applyRunway(baseResult, inflow, outflow, openingBalance);
}

function appendTrace(state: MonthlyAnalysisState, agent: AgentName, input: unknown, output: unknown): MonthlyAnalysisState["traces"][number] {
  return {
    agent,
    inputHash: hashPayload(input),
    outputHash: hashPayload(output),
    schemaPassed: true,
    retryCount: 0,
  };
}

function appendAgentError(state: MonthlyAnalysisState, agent: AgentName, error: unknown): MonthlyAnalysisState["errors"][number] {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return { agent, code: "diagnosis_failed", message, retryable: false };
}

export function runAnomalyDetectionAgent(state: MonthlyAnalysisState): MonthlyAnalysisState {
  const agent: AgentName = "anomaly-detection";
  try {
    const input = { dre: state.dre, normalizedEntries: state.normalizedEntries, segment: state.segment, previousDre: state.previousDre };
    const anomalies = detectFinancialAnomalies(input);
    return { ...state, anomalies, traces: [...state.traces, appendTrace(state, agent, input, anomalies)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}

export function runMarginDiagnosisAgent(state: MonthlyAnalysisState): MonthlyAnalysisState {
  const agent: AgentName = "margin-diagnosis";
  try {
    const marginDiagnosis = diagnoseMargins(state.dre, state.segment);
    return { ...state, marginDiagnosis, traces: [...state.traces, appendTrace(state, agent, state.dre, marginDiagnosis)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}

export function runCashflowRiskAgent(state: MonthlyAnalysisState): MonthlyAnalysisState {
  const agent: AgentName = "cashflow-risk";
  try {
    const cashflowRisk = assessCashflowRisk(state.normalizedEntries, { openingBalance: state.openingBalance });
    return { ...state, cashflowRisk, traces: [...state.traces, appendTrace(state, agent, state.normalizedEntries, cashflowRisk)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}
