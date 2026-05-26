// Método assertion_shape — valida shape de saída sem custo de LLM.
//
// Para outcome "dre_aggregated": executa aggregateDre() diretamente com EntryRows
// construídos a partir do Input do case, compara contra o Ground truth YAML.
//
// Para demais outcomes (hub, ingest, action-plan plan_approved): requerem fixture de
// banco — marcados como "skipped:db_fixture_required" e excluídos do cálculo de pass rate.

import { aggregateDre, type DreLines } from "@/dre-narrative/aggregator.js";
import { runDeterministicFinancialQaReview } from "@/monthly-analysis/agents/financial-qa-review.js";
import { runNormalizationAgent, type RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";
import { runNarrativeSynthesisAgent } from "@/monthly-analysis/agents/narrative-synthesis.js";
import type { NarrativeSynthesisAgentInput } from "@/monthly-analysis/agents/narrative-synthesis.js";
import { runActionPlanningAgent, type ActionPlanningAgentInput } from "@/monthly-analysis/agents/action-planning.js";
import type { ActionPlanDraft, Anomaly, CashflowRisk, MarginDiagnosis, NarrativeCardDraft } from "@/monthly-analysis/schemas/agents.js";
import { loadCases } from "../case-loader.js";
import { hashPrompt } from "../prompt-hash.js";
import type { BucketSummary, CaseFile, CaseResult, RunSummary } from "../types.js";

// ─── Mapeamento: chave do Input → categoria da taxonomia ─────────────────────

const INPUT_CATEGORY_MAP: Record<string, { category: string; direction: "credit" | "debit" }> = {
  receitaBruta:                { category: "receita_bruta",                direction: "credit" },
  deducoes:                    { category: "deducoes_receita",              direction: "debit"  },
  cmv:                         { category: "cpv_cmv",                      direction: "debit"  },
  custoServicos:               { category: "custo_servicos",               direction: "debit"  },
  despesasPessoal:             { category: "despesas_pessoal",             direction: "debit"  },
  prolabore:                   { category: "prolabore",                    direction: "debit"  },
  despesasAdministrativas:     { category: "despesas_administrativas",     direction: "debit"  },
  despesasAdm:                 { category: "despesas_administrativas",     direction: "debit"  },
  despesasOperacionais:        { category: "despesas_administrativas",     direction: "debit"  },
  despesasComerciais:          { category: "despesas_comerciais",          direction: "debit"  },
  despesasTi:                  { category: "despesas_ti",                  direction: "debit"  },
  despesasTecnologia:          { category: "despesas_ti",                  direction: "debit"  },
  despesasViagem:              { category: "despesas_viagem",              direction: "debit"  },
  despesasJuridicas:           { category: "despesas_juridicas",           direction: "debit"  },
  despesasFinanceiras:         { category: "despesas_financeiras",         direction: "debit"  },
  outrasDespesas:              { category: "outras_despesas",              direction: "debit"  },
  despesasOcupacao:            { category: "outras_despesas",              direction: "debit"  },
  outrasReceitasOperacionais:  { category: "outras_receitas_operacionais", direction: "credit" },
  irCsll:                      { category: "irpj_csll",                    direction: "debit"  },
  impostos:                    { category: "irpj_csll",                    direction: "debit"  },
  simplesNacional:             { category: "simples_nacional",             direction: "debit"  },
  depreciacao:                 { category: "depreciacao",                  direction: "debit"  },
  amortizacao:                 { category: "amortizacao_ativos",           direction: "debit"  },
  receitaFinanceira:           { category: "receita_financeira",           direction: "credit" },
  receitasFinanceiras:         { category: "receita_financeira",           direction: "credit" },
  emprestimosEntrada:          { category: "emprestimos_entrada",          direction: "credit" },
  amortizacaoDividas:          { category: "amortizacao_dividas",          direction: "debit"  },
  capex:                       { category: "capex",                        direction: "debit"  },
  transferenciaInterna:        { category: "transferencia_interna",        direction: "debit"  },
  naoClassificado:             { category: "nao_classificado",             direction: "debit"  },
};

// ─── Mapeamento: chave do Ground truth YAML → propriedade de DreLines ─────────

const EXPECTED_TO_DRE_MAP: Record<string, keyof DreLines> = {
  receitaBruta:                "receitaBruta",
  deducoes:                    "deducoes",
  receitaLiquida:              "receitaLiquida",
  cmv:                         "custosDiretos",
  custosDiretos:               "custosDiretos",
  lucroBruto:                  "lucroBruto",
  margemBruta:                 "margemBruta",
  despesasPessoal:             "despesasPessoal",
  prolabore:                   "prolabore",
  despesasAdm:                 "despesasAdm",
  despesasAdministrativas:     "despesasAdm",
  despesasComerciais:          "despesasComerciais",
  despesasTi:                  "despesasTi",
  despesasTecnologia:          "despesasTi",
  despesasViagem:              "despesasViagem",
  despesasJuridicas:           "despesasJuridicas",
  despesasFinanceiras:         "despesasFinanceiras",
  outrasDespesas:              "outrasDespesas",
  despesasOcupacao:            "outrasDespesas",
  outrasReceitasOp:            "outrasReceitasOp",
  outrasReceitasOperacionais:  "outrasReceitasOp",
  totalDespesasOp:             "totalDespesasOp",
  totalDespesasOperacionais:   "totalDespesasOp",
  ebitda:                      "ebitda",
  margemEbitda:                "margemEbitda",
  depreciacao:                 "depreciacao",
  amortizacao:                 "amortizacao",
  ebit:                        "ebit",
  lucroOperacional:            "ebit",
  margemOperacional:           "margemOperacional",
  receitaFinanceira:           "receitaFinanceira",
  receitasFinanceiras:         "receitaFinanceira",
  resultadoFinanceiro:         "resultadoFinanceiro",
  resultadoAntesImpostos:      "resultadoAntesImpostos",
  lucroAntesIR:                "resultadoAntesImpostos",
  impostos:                    "impostos",
  irCsll:                      "impostos",
  lucroLiquido:                "lucroLiquido",
  margemLiquida:               "margemLiquida",
  naoClassificado:             "naoClassificado",
  emprestimosEntrada:          "emprestimosEntrada",
  amortizacaoDividas:          "amortizacaoDividas",
  capex:                       "capex",
  transferenciaInterna:        "transferenciaInterna",
};

// ─── Runner principal ─────────────────────────────────────────────────────────

interface RunOptions {
  module: string;
  outcomes?: string[];
  passRateThreshold: number;
  passRatePerOutcome?: Record<string, number>;
  maxCases?: number;
}

export async function runAssertionShape(opts: RunOptions): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const allCasesRaw = loadCases(opts.module);

  const relevantCases = opts.outcomes
    ? allCasesRaw.filter((c) => opts.outcomes!.includes(c.outcome))
    : allCasesRaw;

  const cases = typeof opts.maxCases === "number" ? relevantCases.slice(0, opts.maxCases) : relevantCases;
  const promptHash = hashPrompt(`assertion_shape:${opts.module}:v1`);
  const results: CaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const file = cases[i];
    if (!file) continue;
    process.stdout.write(`  [${i + 1}/${cases.length}] ${file.caseId} (${file.outcome}) ... `);

    const t0 = Date.now();
    let result: CaseResult;

    try {
      result = await executeCase(file);
      result = { ...result, latencyMs: Date.now() - t0 };
    } catch (err) {
      result = {
        caseId: file.caseId,
        outcome: file.outcome,
        sourceMode: file.sourceMode,
        passed: false,
        predicted: null,
        expected: null,
        confidence: null,
        reason: `execute_error: ${(err as Error).message.slice(0, 500)}`,
        latencyMs: Date.now() - t0,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
      };
    }

    results.push(result);
    const isSkip = result.reason.startsWith("skipped:");
    const label = result.passed && !isSkip ? "PASS" : isSkip ? `SKIP` : `FAIL (${result.reason})`;
    console.log(label);
  }

  return buildSummary({
    module: opts.module,
    evalMethod: "assertion_shape",
    promptHash,
    provider: "none",
    model: "none",
    passRateThreshold: opts.passRateThreshold,
    passRatePerOutcome: opts.passRatePerOutcome,
    totalCasesAll: relevantCases.length,
    cases: results,
    startedAt,
  });
}

// ─── Dispatcher por outcome ───────────────────────────────────────────────────

async function executeCase(file: CaseFile): Promise<CaseResult> {
  if (file.outcome === "dre_aggregated") {
    return executeDreAggregated(file);
  }
  if (file.module === "monthly-analysis/financial-qa-review") {
    return executeFinancialQaReview(file);
  }
  if (file.module === "monthly-analysis/normalization") {
    return executeNormalization(file);
  }
  if (file.module === "monthly-analysis/narrative-synthesis") {
    return executeNarrativeSynthesis(file);
  }
  if (file.module === "monthly-analysis/action-planning") {
    return executeActionPlanning(file);
  }
  return makeResult(
    file, true,
    "skipped:db_fixture_required — outcome requer fixture de banco",
    "skipped", "n/a",
  );
}

// ─── Helpers compartilhados ───────────────────────────────────────────────────

function extractInputBlock(file: CaseFile): string {
  return file.body.match(/##\s*Input[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? "";
}

function makeDefaultDre(): DreLines {
  return {
    receitaBruta: 0, deducoes: 0, receitaLiquida: 0,
    custosDiretos: 0, lucroBruto: 0, margemBruta: 0,
    despesasPessoal: 0, prolabore: 0, despesasAdm: 0,
    despesasComerciais: 0, despesasTi: 0, despesasViagem: 0,
    despesasJuridicas: 0, despesasFinanceiras: 0, outrasDespesas: 0,
    outrasReceitasOp: 0, totalDespesasOp: 0, ebitda: 0,
    margemEbitda: 0, depreciacao: 0, amortizacao: 0, ebit: 0,
    margemOperacional: 0, receitaFinanceira: 0, resultadoFinanceiro: 0,
    resultadoAntesImpostos: 0, impostos: 0, lucroLiquido: 0,
    margemLiquida: 0, emprestimosEntrada: 0, amortizacaoDividas: 0,
    capex: 0, transferenciaInterna: 0, naoClassificado: 0,
  };
}

function parseDreKeyValueString(input: string): DreLines {
  const dre = makeDefaultDre();
  for (const pair of input.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const k = pair.slice(0, eqIdx).trim();
    const v = parseFloat(pair.slice(eqIdx + 1).trim());
    if (k && !isNaN(v) && k in dre) (dre as Record<string, number>)[k] = v;
  }
  return dre;
}

function buildDefaultMarginDiagnosis(dre: DreLines): MarginDiagnosis {
  return {
    grossMarginStatus: dre.margemBruta >= 30 ? "healthy" : dre.margemBruta >= 15 ? "attention" : "critical",
    operatingMarginStatus: dre.margemEbitda >= 10 ? "healthy" : dre.margemEbitda >= 5 ? "attention" : "critical",
    mainDrivers: [{ driver: "margem bruta", evidenceMetric: "margemBruta", impactCents: 0, severity: "low" }],
  };
}

function buildDefaultCashflowRisk(): CashflowRisk {
  return { status: "healthy", reasons: ["Sem alertas de caixa."], limitations: [] };
}

// ─── Executor normalization ───────────────────────────────────────────────────

function parseNormalizationEntries(file: CaseFile): RawLedgerEntry[] {
  const block = extractInputBlock(file);
  const entries: RawLedgerEntry[] = [];
  let idx = 0;
  const pattern = /^\s*-\s+description:\s*"([^"]+)"\s*\n\s*direction:\s*"?(\w+)"?\s*\n\s*amountCents:\s*(-?\d+)\s*\n\s*date:\s*"?(\d{4}-\d{2}-\d{2})"?/gm;
  for (const m of block.matchAll(pattern)) {
    const [, description, direction, amount, date] = m;
    entries.push({
      entryId: `eval-${file.caseId}-${++idx}`,
      description: description!,
      direction: direction === "credit" ? "in" : "out",
      amountCents: Math.abs(Number(amount)),
      date: date!,
    });
  }
  return entries;
}

async function executeNormalization(file: CaseFile): Promise<CaseResult> {
  const rawEntries = parseNormalizationEntries(file);
  if (rawEntries.length === 0) {
    return makeResult(file, false, "parse_error: nenhuma raw_entry encontrada no Input", null, null);
  }
  const normalized = await runNormalizationAgent(rawEntries, { tenantId: "eval-tenant" });
  if (normalized.length !== rawEntries.length) {
    return makeResult(
      file, false,
      `count_mismatch: input=${rawEntries.length} output=${normalized.length} (drop/merge proibido)`,
      String(normalized.length), String(rawEntries.length),
    );
  }
  // amountCents + date já validados por assertImmutableFinancialFields dentro do agente.
  // Zod (NormalizedLedgerEntrySchema) já validou required_fields.
  return makeResult(file, true, "ok", `${normalized.length} entries — schema+invariant ok`, `${rawEntries.length} entries esperados`);
}

// ─── Executor narrative-synthesis ────────────────────────────────────────────

function parseNarrativeSynthesisInput(file: CaseFile): NarrativeSynthesisAgentInput {
  const block = extractInputBlock(file);
  const dreStr = /dre:\s*"([^"]+)"/.exec(block)?.[1] ?? "";
  const dre = parseDreKeyValueString(dreStr);
  return {
    dre,
    anomalies: [],
    marginDiagnosis: buildDefaultMarginDiagnosis(dre),
    cashflowRisk: buildDefaultCashflowRisk(),
  };
}

async function executeNarrativeSynthesis(file: CaseFile): Promise<CaseResult> {
  const input = parseNarrativeSynthesisInput(file);
  // NarrativeCardDraftsSchema (.length(3).refine) garante exatamente 3 cards, um de cada tipo.
  // Se parseAgentJson não lançou, o contrato foi cumprido.
  const cards = await runNarrativeSynthesisAgent(input, { tenantId: "eval-tenant" });
  const cardTypes = cards.map((c) => c.type).sort().join(",");
  return makeResult(file, true, "ok", `3 cards: ${cardTypes}`, "attention,critical_gap,healthy");
}

// ─── Executor action-planning ─────────────────────────────────────────────────

function parseActionPlanningInput(file: CaseFile): ActionPlanningAgentInput {
  const block = extractInputBlock(file);
  const dreStr = /dre_and_diagnostics:\s*"([^"]+)"/.exec(block)?.[1] ?? "";
  const dre = parseDreKeyValueString(dreStr);

  const cardTypes = [...block.matchAll(/type:\s*(\w+)/g)].map((m) => m[1] as NarrativeCardDraft["type"]);
  const narrativeCards: NarrativeCardDraft[] = cardTypes.length >= 1
    ? cardTypes.map((type) => ({ type, title: `Card ${type}`, body: "Diagnóstico para plano de ação.", evidenceRefs: ["margemLiquida"] }))
    : [
        { type: "critical_gap", title: "Atenção necessária", body: "Ponto crítico identificado no período.", evidenceRefs: ["margemLiquida"] },
        { type: "attention", title: "Monitorar", body: "Ponto de atenção requer acompanhamento.", evidenceRefs: ["despesasComerciais"] },
        { type: "healthy", title: "Resultado positivo", body: "Indicador saudável no período.", evidenceRefs: ["margemBruta"] },
      ];

  return {
    dre,
    anomalies: [],
    narrativeCards,
    marginDiagnosis: buildDefaultMarginDiagnosis(dre),
    cashflowRisk: buildDefaultCashflowRisk(),
  };
}

async function executeActionPlanning(file: CaseFile): Promise<CaseResult> {
  const input = parseActionPlanningInput(file);
  // ActionPlanDraftSchema já valida ≥5 ações, ≥3 short, ≥1 medium, ≥1 long.
  const plan = await runActionPlanningAgent(input, { tenantId: "eval-tenant" });
  const short = plan.actions.filter((a) => a.horizon === "short").length;
  const medium = plan.actions.filter((a) => a.horizon === "medium").length;
  const long = plan.actions.filter((a) => a.horizon === "long").length;
  return makeResult(
    file, true, "ok",
    `${plan.actions.length} ações: short=${short} medium=${medium} long=${long}`,
    "≥5 total, ≥3 short, ≥1 medium, ≥1 long",
  );
}

// ─── Executor dre_aggregated (função pura — sem LLM, sem DB) ─────────────────

function executeFinancialQaReview(file: CaseFile): CaseResult {
  const review = runDeterministicFinancialQaReview(buildFinancialQaFixture(file.caseId));
  const expected = parseFinancialQaExpected(file);
  const failures: string[] = [];

  if (review.publishable !== expected.publishable) {
    failures.push(`publishable esperado=${expected.publishable} atual=${review.publishable}`);
  }
  for (const target of expected.retryTargets) {
    if (!review.retryTargets.includes(target)) failures.push(`retryTarget ausente=${target}`);
  }
  if (!expected.publishable && review.issues.length === 0) failures.push("esperava ao menos 1 issue");
  if (expected.issueCode && !review.issues.some((issue) => issue.code === expected.issueCode)) {
    failures.push(`issue code ausente=${expected.issueCode}`);
  }

  return makeResult(
    file,
    failures.length === 0,
    failures.length === 0 ? "ok" : failures.join("; "),
    JSON.stringify(review).slice(0, 500),
    JSON.stringify(expected),
  );
}

function parseFinancialQaExpected(file: CaseFile): {
  publishable: boolean;
  retryTargets: Array<"narrative-synthesis" | "action-planning">;
  issueCode?: string;
} {
  const expectedText = file.body.match(/expected:\s*"([^"]+)"/i)?.[1] ?? "";
  return {
    publishable: /publishable=true/i.test(expectedText),
    retryTargets: [
      ...(expectedText.includes("narrative-synthesis") ? ["narrative-synthesis" as const] : []),
      ...(expectedText.includes("action-planning") ? ["action-planning" as const] : []),
    ],
    issueCode: issueCodeForFinancialQaOutcome(file.outcome),
  };
}

function issueCodeForFinancialQaOutcome(outcome: string): string | undefined {
  switch (outcome) {
    case "detect_metric_mismatch": return "NUMBER_MISMATCH";
    case "detect_schema_gap": return "MISSING_DONEWHEN";
    case "detect_evidence_gap": return "MISSING_EVIDENCE";
    case "detect_contradiction": return "CONTRADICTION";
    case "detect_review_need":
    case "detect_overclaim":
    case "detect_implausible_impact":
    case "detect_tax_overreach":
      return "UNFOUNDED_CLAIM";
    case "detect_omission": return "MISSING_EVIDENCE";
    default: return undefined;
  }
}

function buildFinancialQaFixture(caseId: string): {
  dre: DreLines;
  anomalies: Anomaly[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  narrativeCards: NarrativeCardDraft[];
  actionPlan: ActionPlanDraft;
} {
  const dre = financialQaDre();
  const anomalies: Anomaly[] = [];
  const marginDiagnosis: MarginDiagnosis = {
    grossMarginStatus: "healthy",
    operatingMarginStatus: "healthy",
    mainDrivers: [{ driver: "margem bruta estavel", evidenceMetric: "margemBruta", impactCents: 0, severity: "low" }],
  };
  const cashflowRisk: CashflowRisk = { status: "healthy", reasons: ["Caixa sem alerta material."], limitations: [] };
  const narrativeCards = financialQaCards();
  const actionPlan = financialQaActionPlan();

  if (caseId === "financial-qa-review-0001") {
    narrativeCards[0] = { ...narrativeCards[0]!, body: "Margem bruta de 62% mostra melhora relevante no mes." };
  } else if (caseId === "financial-qa-review-0002") {
    actionPlan.actions[0] = { ...actionPlan.actions[0]!, doneWhen: "" };
  } else if (caseId === "financial-qa-review-0003") {
    actionPlan.actions[0] = { ...actionPlan.actions[0]!, evidenceRefs: [] };
  } else if (caseId === "financial-qa-review-0004") {
    dre.margemLiquida = -7;
    narrativeCards[2] = { type: "healthy", title: "Mes altamente lucrativo", body: "Mes altamente lucrativo e saudavel para seguir expandindo.", evidenceRefs: ["margemLiquida"] };
  } else if (caseId === "financial-qa-review-0005") {
    anomalies.push({ code: "data_conflict_high", title: "Dados contraditorios", description: "Lancamentos severos precisam revisao.", severity: "high", evidenceMetric: "naoClassificado" });
    actionPlan.actions[0] = {
      ...actionPlan.actions[0]!,
      title: "Demitir 30% imediatamente",
      description: "Desligar 30% da equipe sem etapa de revisao para reduzir custo.",
      doneWhen: "30% da equipe desligada ate 2026-07-01.",
      evidenceRefs: ["data_conflict_high"],
    };
    narrativeCards[0] = { ...narrativeCards[0]!, evidenceRefs: ["data_conflict_high"] };
  } else if (caseId === "financial-qa-review-0006") {
    anomalies.push({ code: "DUPLICATE_SUSPECT", title: "Duplicidade suspeita", description: "Possivel pagamento duplicado ainda nao comprovado.", severity: "medium", evidenceMetric: "entry:dup" });
    narrativeCards[0] = { title: "Fraude comprovada", type: "critical_gap", body: "Ha fraude comprovada no pagamento duplicado.", evidenceRefs: ["DUPLICATE_SUSPECT"] };
  } else if (caseId === "financial-qa-review-0007") {
    dre.naoClassificado = 38_000_00;
  } else if (caseId === "financial-qa-review-0008") {
    actionPlan.actions[0] = { ...actionPlan.actions[0]!, impactCents: 50_000_000 };
  } else if (caseId === "financial-qa-review-0010") {
    actionPlan.actions[0] = {
      ...actionPlan.actions[0]!,
      title: "Trocar regime tributario",
      description: "Trocar regime para reduzir 40% imposto ja no proximo mes.",
      doneWhen: "Imposto reduzido em 40% ate 2026-07-01.",
    };
  }

  return { dre, anomalies, marginDiagnosis, cashflowRisk, narrativeCards, actionPlan };
}

function financialQaDre(): DreLines {
  return {
    receitaBruta: 10_000_000, deducoes: 0, receitaLiquida: 10_000_000,
    custosDiretos: 5_263_000, lucroBruto: 4_737_000, margemBruta: 47.37,
    despesasPessoal: 1_000_000, prolabore: 0, despesasAdm: 500_000,
    despesasComerciais: 300_000, despesasTi: 100_000, despesasViagem: 0,
    despesasJuridicas: 0, despesasFinanceiras: 100_000, outrasDespesas: 0,
    outrasReceitasOp: 0, totalDespesasOp: 1_900_000, ebitda: 2_837_000,
    margemEbitda: 28.37, depreciacao: 0, amortizacao: 0, ebit: 2_837_000,
    margemOperacional: 28.37, receitaFinanceira: 0, resultadoFinanceiro: -100_000,
    resultadoAntesImpostos: 2_737_000, impostos: 1_237_000, lucroLiquido: 1_500_000,
    margemLiquida: 15, emprestimosEntrada: 0, amortizacaoDividas: 0, capex: 0,
    transferenciaInterna: 0, naoClassificado: 0,
  };
}

function financialQaCards(): NarrativeCardDraft[] {
  return [
    { type: "critical_gap", title: "Margem bruta monitorada", body: "Margem bruta de 47.37% esta coerente com a DRE.", evidenceRefs: ["margemBruta"] },
    { type: "attention", title: "Despesa comercial sob controle", body: "Despesa comercial deve seguir monitorada.", evidenceRefs: ["despesasComerciais"] },
    { type: "healthy", title: "Lucro liquido saudavel", body: "Margem liquida de 15% sustenta plano conservador.", evidenceRefs: ["margemLiquida"] },
  ];
}

function financialQaActionPlan(): ActionPlanDraft {
  const base = {
    description: "Executar rotina com evidencia financeira rastreavel.",
    effortLevel: "low" as const,
    riskLevel: "low" as const,
    impactCents: 300_000,
    doneWhen: "Resultado registrado em R$ 3.000 ate 2026-07-01.",
    evidenceRefs: ["margemBruta"],
    assumptions: [],
    confidence: 0.8,
  };
  return {
    actions: [
      { ...base, horizon: "short", title: "Revisar margem por categoria" },
      { ...base, horizon: "short", title: "Acompanhar despesas comerciais" },
      { ...base, horizon: "short", title: "Validar caixa semanal" },
      { ...base, horizon: "medium", title: "Padronizar compras" },
      { ...base, horizon: "long", title: "Criar governanca mensal" },
    ],
  };
}

function executeDreAggregated(file: CaseFile): CaseResult {
  let entries: EntryRow[];
  try {
    entries = parseDreInputSection(file);
  } catch (err) {
    return makeResult(file, false, `parse_input_error: ${(err as Error).message}`, null, null);
  }

  let expected: Record<string, number>;
  try {
    expected = parseDreExpectedSection(file);
  } catch (err) {
    return makeResult(file, false, `parse_expected_error: ${(err as Error).message}`, null, null);
  }

  const actual = aggregateDre(entries);
  const mismatches: string[] = [];
  const warnings: string[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const dreKey = EXPECTED_TO_DRE_MAP[key];
    if (!dreKey) {
      warnings.push(`"${key}" não mapeado em DreLines`);
      continue;
    }
    const actualValue = actual[dreKey];
    if (!isNumericallyClose(actualValue, expectedValue)) {
      mismatches.push(`${key}: esperado=${expectedValue} atual=${actualValue}`);
    }
  }

  const passed = mismatches.length === 0;
  const warnSuffix = warnings.length > 0 ? ` — avisos: ${warnings.join("; ")}` : "";
  const reason = passed ? `ok${warnSuffix}` : mismatches.join("; ");

  const predictedSnap = pickMapped(actual, expected);
  return makeResult(
    file, passed, reason,
    JSON.stringify(predictedSnap).slice(0, 500),
    JSON.stringify(expected).slice(0, 500),
  );
}

function pickMapped(actual: DreLines, expected: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(expected)) {
    const dreKey = EXPECTED_TO_DRE_MAP[key];
    if (dreKey) out[key] = actual[dreKey];
  }
  return out;
}

// ─── Parser: seção Input → EntryRow[] ────────────────────────────────────────

interface EntryRow {
  amountCents: number;
  direction: "credit" | "debit";
  predictedCategory: string | null;
  confirmedCategory: string | null;
}

function parseDreInputSection(file: CaseFile): EntryRow[] {
  const m = file.body.match(/##\s*Input[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!m || !m[1]) throw new Error(`Sem bloco "## Input" em ${file.filePath}`);

  const block = m[1];
  const entries: EntryRow[] = [];
  const seen = new Set<string>();

  function addConfirmed(catKey: string, amountCents: number): void {
    const mapping = INPUT_CATEGORY_MAP[catKey];
    if (!mapping || amountCents === 0) return;
    const uid = `C:${mapping.category}:${amountCents}`;
    if (seen.has(uid)) return;
    seen.add(uid);
    entries.push({ amountCents, direction: mapping.direction, predictedCategory: null, confirmedCategory: mapping.category });
  }

  function addPredicted(catKey: string, amountCents: number): void {
    const mapping = INPUT_CATEGORY_MAP[catKey];
    if (!mapping || amountCents === 0) return;
    const uid = `P:${mapping.category}:${amountCents}`;
    if (seen.has(uid)) return;
    seen.add(uid);
    entries.push({ amountCents, direction: mapping.direction, predictedCategory: mapping.category, confirmedCategory: null });
  }

  // Strategy A: confirmedCategory="key" (R$ value)
  // `[^(]*` tolera backtick/espaços entre a aspa de fechamento e o parêntese de valor
  for (const mm of block.matchAll(/confirmedCategory="([^"]+)"[^(]*\(R\$\s*([\d.,]+)\)/g)) {
    const [, catKey, rawVal] = mm;
    if (!catKey || !rawVal) continue;
    addConfirmed(catKey, parseBrlToCents(`R$ ${rawVal}`));
  }

  // Strategy B: predictedCategory: key=value; key=value segments
  for (const mm of block.matchAll(/predictedCategory:\s*([^)]+)/g)) {
    const segment = mm[1] ?? "";
    for (const pair of segment.split(";")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const key = (/^([a-zA-Z][a-zA-Z0-9]*)/.exec(pair.slice(0, eqIdx).trim()))?.[1] ?? "";
      const amountCents = parseBrlToCents(pair.slice(eqIdx + 1).trim());
      addPredicted(key, amountCents);
    }
  }

  // Strategy C: totalizando R$ value → nao_classificado
  for (const mm of block.matchAll(/totalizando\s+R\$\s*([\d.,]+)/g)) {
    const amountCents = parseBrlToCents(`R$ ${mm[1] ?? ""}`);
    if (amountCents > 0) {
      entries.push({ amountCents, direction: "debit", predictedCategory: null, confirmedCategory: "nao_classificado" });
    }
  }

  // Strategy D: standard key=value from semicolon-delimited lines
  for (const rawLine of block.split("\n")) {
    const listStripped = rawLine.replace(/^[-*]\s*/, "");

    // Pula linhas de variantes não-primárias (Variante B, C, ...)
    if (/^Variante\s+[B-Zb-z]/i.test(listStripped)) continue;

    // Extrai blocos parentéticos com key=value para parsing separado
    const parenSegments: string[] = [];
    const lineWithoutParens = listStripped.replace(/\(([^)]+)\)/g, (_full, inner: string) => {
      if (/[a-zA-Z]+=/.test(inner) && !/^predictedCategory:/i.test(inner.trim())) {
        parenSegments.push(inner);
      }
      return "";
    });

    const mainLine = lineWithoutParens
      .replace(/^Variante\s+[Aa]\s*:\s*/i, "")
      .replace(/^Composição:\s*/i, "");

    for (const segment of [mainLine, ...parenSegments]) {
      for (const pair of segment.split(";")) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx === -1) continue;
        const keyPart = pair.slice(0, eqIdx).trim();
        const valuePart = pair.slice(eqIdx + 1).trim();
        // Varre tokens camelCase no keyPart e usa o primeiro que está no mapa.
        // Necessário quando a chave vem depois de prefixo narrativo (ex: "1 entry: receitaBruta=...")
        const words = keyPart.match(/[a-zA-Z][a-zA-Z0-9]*/g) ?? [];
        const key = words.find((w) => w in INPUT_CATEGORY_MAP) ?? "";
        if (!key) continue;
        addConfirmed(key, parseBrlToCents(valuePart));
      }
    }
  }

  return entries;
}

function parseBrlToCents(raw: string): number {
  const cleaned = raw.replace(/^R\$\s*/, "").trim();
  if (!cleaned) return 0;
  // Extrai número brasileiro no início: pontos como separador de milhar, vírgula decimal
  const numMatch = /^-?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)/.exec(cleaned);
  if (!numMatch) return 0;
  const normalized = numMatch[0].replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : Math.round(value * 100);
}

// ─── Parser: seção Ground truth → Record<key, number> ────────────────────────

function parseDreExpectedSection(file: CaseFile): Record<string, number> {
  const m = file.body.match(/##\s*Ground truth[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!m || !m[1]) throw new Error(`Sem bloco "## Ground truth" em ${file.filePath}`);

  const yamlMatch = m[1].match(/```yaml\s*\n([\s\S]*?)\n```/);
  const yamlBody = yamlMatch?.[1] ?? m[1];

  const result: Record<string, number> = {};
  for (const line of yamlBody.split("\n")) {
    const noComment = line.replace(/#.*$/, "").trim();
    if (!noComment) continue;
    const colon = noComment.indexOf(":");
    if (colon === -1) continue;
    const key = noComment.slice(0, colon).trim();
    const valueStr = noComment.slice(colon + 1).trim();
    if (!valueStr) continue;
    const value = parseFloat(valueStr);
    if (!isNaN(value)) result[key] = value;
    // valores "null" são simplesmente ignorados (não entram na comparação)
  }

  if (Object.keys(result).length === 0) {
    throw new Error(`Ground truth vazio ou não-parseável em ${file.filePath}`);
  }
  return result;
}

// ─── Comparação numérica ──────────────────────────────────────────────────────

function isNumericallyClose(actual: number, expected: number): boolean {
  if (actual === expected) return true;
  if (Number.isInteger(expected) && Number.isInteger(actual)) return actual === expected;
  // Margens em %: tolerância de 0.01pp (1 ponto-base)
  return Math.abs(actual - expected) < 0.01;
}

// ─── Helpers de resultado e sumário ──────────────────────────────────────────

function makeResult(
  file: CaseFile,
  passed: boolean,
  reason: string,
  predicted: string | null,
  expected: string | null,
): CaseResult {
  return {
    caseId: file.caseId,
    outcome: file.outcome,
    sourceMode: file.sourceMode,
    passed,
    predicted,
    expected,
    confidence: null,
    reason,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
  };
}

function buildSummary(args: {
  module: string;
  evalMethod: string;
  promptHash: string;
  provider: string;
  model: string;
  passRateThreshold: number;
  passRatePerOutcome?: Record<string, number>;
  totalCasesAll: number;
  cases: CaseResult[];
  startedAt: string;
}): RunSummary {
  // Cases com "skipped:" não entram no cálculo de pass rate
  const attempted = args.cases.filter((c) => !c.reason.startsWith("skipped:"));
  const passed = attempted.filter((c) => c.passed).length;
  const failed = attempted.length - passed;
  const passRate = attempted.length === 0 ? 1 : passed / attempted.length;
  const totalCostCents = args.cases.reduce((s, c) => s + c.costCents, 0);
  const totalLatencyMs = args.cases.reduce((s, c) => s + c.latencyMs, 0);

  const byOutcome = bucketize(attempted, (c) => c.outcome);
  const bySourceMode = bucketize(attempted, (c) => c.sourceMode);

  let thresholdMet: boolean;
  if (args.passRatePerOutcome) {
    thresholdMet = true;
    for (const [outcome, bucket] of Object.entries(byOutcome)) {
      const t = args.passRatePerOutcome[outcome];
      if (typeof t === "number") {
        bucket.threshold = t;
        bucket.thresholdMet = bucket.passRate >= t;
        if (!bucket.thresholdMet) thresholdMet = false;
      }
    }
  } else {
    thresholdMet = passRate >= args.passRateThreshold;
  }

  return {
    module: args.module,
    evalMethod: args.evalMethod,
    promptHash: args.promptHash,
    provider: args.provider,
    model: args.model,
    totalCases: args.totalCasesAll,
    attemptedCases: attempted.length,
    passed,
    failed,
    passRate,
    passRateThreshold: args.passRateThreshold,
    passRatePerOutcome: args.passRatePerOutcome,
    thresholdMet,
    totalCostCents,
    totalLatencyMs,
    startedAt: args.startedAt,
    finishedAt: new Date().toISOString(),
    byOutcome,
    bySourceMode,
    cases: args.cases,
  };
}

function bucketize(cases: CaseResult[], keyFn: (c: CaseResult) => string): Record<string, BucketSummary> {
  const out: Record<string, BucketSummary> = {};
  for (const c of cases) {
    const key = keyFn(c);
    const cur = out[key] ?? { total: 0, passed: 0, passRate: 0 };
    cur.total++;
    if (c.passed) cur.passed++;
    out[key] = cur;
  }
  for (const k of Object.keys(out)) {
    const b = out[k];
    if (b) b.passRate = b.total === 0 ? 0 : b.passed / b.total;
  }
  return out;
}
