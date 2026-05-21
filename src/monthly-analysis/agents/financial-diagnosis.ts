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
}): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { dre, normalizedEntries = [] } = input;

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

  if (dre.lucroLiquido < 0 && netLossRatio >= 0.1) {
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
  } else if (dre.margemOperacional < 5) {
    anomalies.push(anomaly(
      "thin_operating_margin",
      "Margem operacional estreita",
      `A margem operacional de ${pct(dre.margemOperacional)} deixa pouca folga para impostos, juros e oscilações de receita.`,
      "medium",
      `margem_operacional=${pct(dre.margemOperacional)}`,
    ));
  }

  if (dre.margemBruta < 20) {
    anomalies.push(anomaly(
      "gross_margin_critical",
      "Margem bruta crítica",
      `Custos diretos consomem a maior parte da receita; margem bruta atual é ${pct(dre.margemBruta)}.`,
      "high",
      `margem_bruta=${pct(dre.margemBruta)}; custos_diretos=${money(dre.custosDiretos)}`,
      Math.max(0, dre.custosDiretos - Math.round(revenue * 0.8)),
    ));
  } else if (dre.margemBruta < 35) {
    anomalies.push(anomaly(
      "gross_margin_attention",
      "Margem bruta em atenção",
      `A margem bruta de ${pct(dre.margemBruta)} sugere pressão de custos diretos ou precificação.`,
      "medium",
      `margem_bruta=${pct(dre.margemBruta)}`,
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

  return anomalies;
}

export function diagnoseMargins(dre?: DreLines): MarginDiagnosis {
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

  const grossMarginStatus = statusFromMargin(dre.margemBruta, { healthy: 50, attention: 30 });
  const operatingMarginStatus = statusFromMargin(dre.margemOperacional, { healthy: 15, attention: 5 });
  const drivers: Driver[] = [];

  if (grossMarginStatus !== "healthy") {
    const targetCostRatio = grossMarginStatus === "critical" ? 0.7 : 0.5;
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

export function assessCashflowRisk(entries?: NormalizedLedgerEntry[]): CashflowRisk {
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

  if (inflow <= 0) {
    return CashflowRiskSchema.parse({
      status: "critical",
      reasons: ["Não há entradas registradas no período, mas existem saídas de caixa."],
      limitations: [],
    });
  }

  if (netCashflow < 0 && burnRatio >= 0.15) {
    return CashflowRiskSchema.parse({
      status: "critical",
      reasons: [`Saídas superam entradas em ${(burnRatio * 100).toFixed(2)}% (${money(Math.abs(netCashflow))}).`],
      limitations: [],
    });
  }

  if (netCashflow < 0 || netMargin < 0.1 || inflowConcentration >= 0.7) {
    const reasons = [
      netCashflow < 0
        ? `Fluxo de caixa líquido negativo em ${money(Math.abs(netCashflow))}.`
        : `Folga líquida baixa: ${(netMargin * 100).toFixed(2)}% das entradas.`,
    ];

    if (inflowConcentration >= 0.7) {
      reasons.push(`Entrada mais relevante concentra ${(inflowConcentration * 100).toFixed(2)}% das entradas.`);
    }

    return CashflowRiskSchema.parse({ status: "attention", reasons, limitations: [] });
  }

  return CashflowRiskSchema.parse({
    status: "healthy",
    reasons: [`Entradas cobrem saídas com folga líquida de ${(netMargin * 100).toFixed(2)}%.`],
    limitations: [],
  });
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
    const input = { dre: state.dre, normalizedEntries: state.normalizedEntries };
    const anomalies = detectFinancialAnomalies(input);
    return { ...state, anomalies, traces: [...state.traces, appendTrace(state, agent, input, anomalies)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}

export function runMarginDiagnosisAgent(state: MonthlyAnalysisState): MonthlyAnalysisState {
  const agent: AgentName = "margin-diagnosis";
  try {
    const marginDiagnosis = diagnoseMargins(state.dre);
    return { ...state, marginDiagnosis, traces: [...state.traces, appendTrace(state, agent, state.dre, marginDiagnosis)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}

export function runCashflowRiskAgent(state: MonthlyAnalysisState): MonthlyAnalysisState {
  const agent: AgentName = "cashflow-risk";
  try {
    const cashflowRisk = assessCashflowRisk(state.normalizedEntries);
    return { ...state, cashflowRisk, traces: [...state.traces, appendTrace(state, agent, state.normalizedEntries, cashflowRisk)] };
  } catch (error) {
    return { ...state, errors: [...state.errors, appendAgentError(state, agent, error)] };
  }
}
