// Método assertion_shape — valida shape de saída sem custo de LLM.
//
// Para outcome "dre_aggregated": executa aggregateDre() diretamente com EntryRows
// construídos a partir do Input do case, compara contra o Ground truth YAML.
//
// Para demais outcomes (hub, ingest, action-plan plan_approved): requerem fixture de
// banco — marcados como "skipped:db_fixture_required" e excluídos do cálculo de pass rate.

import { aggregateDre, type DreLines } from "@/dre-narrative/aggregator.js";
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
      result = executeCase(file);
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

function executeCase(file: CaseFile): CaseResult {
  if (file.outcome === "dre_aggregated") {
    return executeDreAggregated(file);
  }
  return makeResult(
    file, true,
    "skipped:db_fixture_required — outcome requer fixture de banco",
    "skipped", "n/a",
  );
}

// ─── Executor dre_aggregated (função pura — sem LLM, sem DB) ─────────────────

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
