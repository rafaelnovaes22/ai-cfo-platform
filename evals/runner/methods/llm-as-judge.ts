// Método llm_as_judge — gera output via LLM de produção e avalia com LLM-juiz.
//
// Para outcome "dre_narrated" (módulo dre-narrative):
//   1. Parse case → DRE + tenant context
//   2. Chama production LLM (Gemini 2.5 Flash) com prompts reais do narrator
//   3. Recebe NarrativeCards JSON
//   4. Monta rubrica a partir do ground truth do case + manifest
//   5. Chama judge LLM (gpt-4.1-mini) → scores por dimensão (1-5)
//   6. Pass = todas dimensões ≥ judge_threshold_per_dim
//
// Outras combinações módulo×outcome retornam "skipped:judge_not_implemented".

import { z } from "zod";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { callLlm } from "@/llm/index.js";
import { callGoogle } from "@/llm/adapters/google.js";
import { callAnthropic } from "@/llm/adapters/anthropic.js";
import { callOpenAI } from "@/llm/adapters/openai.js";
import { callGroq } from "@/llm/adapters/groq.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "@/llm/types.js";
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
} from "@/dre-narrative/prompts.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import { loadCases } from "../case-loader.js";
import { hashPrompt } from "../prompt-hash.js";
import type { BucketSummary, CaseFile, CaseResult, RunSummary } from "../types.js";

// ─── Manifest extras (campos próprios do llm_as_judge) ────────────────────────

interface JudgeManifest {
  judge_dimensions: string[];
  judge_threshold_per_dim: number;
  judge_scale: string;
  pass_rate_threshold: number;
  pass_rate_per_outcome?: Record<string, number>;
}

function loadJudgeManifest(module: string): JudgeManifest {
  const path = join(resolve(process.cwd(), "evals"), module, "manifest.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<JudgeManifest>;
  if (!Array.isArray(raw.judge_dimensions) || raw.judge_dimensions.length === 0) {
    throw new Error(`manifest de ${module} não declara judge_dimensions`);
  }
  if (typeof raw.judge_threshold_per_dim !== "number") {
    throw new Error(`manifest de ${module} não declara judge_threshold_per_dim`);
  }
  return {
    judge_dimensions: raw.judge_dimensions,
    judge_threshold_per_dim: raw.judge_threshold_per_dim,
    judge_scale: raw.judge_scale ?? "1-5",
    pass_rate_threshold: raw.pass_rate_threshold ?? 0.9,
    pass_rate_per_outcome: raw.pass_rate_per_outcome,
  };
}

// ─── Runner principal ─────────────────────────────────────────────────────────

interface RunOptions {
  module: string;
  outcomes?: string[];
  passRateThreshold: number;
  passRatePerOutcome?: Record<string, number>;
  maxCases?: number;
  // Override apenas do GERADOR (model under test). O juiz continua sendo o
  // configurado em router.ts (task "eval-judge", default gpt-4.1-mini).
  generatorOverride?: { provider: LlmProvider; model: string };
}

export async function runLlmAsJudge(opts: RunOptions): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const manifest = loadJudgeManifest(opts.module);
  const allCasesRaw = loadCases(opts.module);

  const relevantCases = opts.outcomes
    ? allCasesRaw.filter((c) => opts.outcomes!.includes(c.outcome))
    : allCasesRaw;

  const cases =
    typeof opts.maxCases === "number" ? relevantCases.slice(0, opts.maxCases) : relevantCases;

  // promptHash inclui sysprompt + dimensões — invalida runs antigas quando rubrica muda
  const promptHash = hashPrompt(
    `llm_as_judge:${opts.module}:dims=${manifest.judge_dimensions.join(",")}:thr=${manifest.judge_threshold_per_dim}`,
  );

  const generatorTag = opts.generatorOverride
    ? `gen=${opts.generatorOverride.provider}:${opts.generatorOverride.model}`
    : "gen=router";
  console.log(`[llm_as_judge] ${generatorTag}  judge=router(eval-judge)`);

  const results: CaseResult[] = [];

  // Rate limit defensivo para provider=groq (free tier ~6K TPM, reasoning
  // models consomem muito por request). Espalha requests em ~8s entre cada.
  const inteRequestSleepMs = opts.generatorOverride?.provider === "groq" ? 8000 : 0;

  for (let i = 0; i < cases.length; i++) {
    const file = cases[i];
    if (!file) continue;
    if (i > 0 && inteRequestSleepMs > 0) {
      await new Promise((res) => setTimeout(res, inteRequestSleepMs));
    }
    process.stdout.write(`  [${i + 1}/${cases.length}] ${file.caseId} (${file.outcome}) ... `);

    const t0 = Date.now();
    let result: CaseResult;
    try {
      result = await executeCase(file, manifest, opts.generatorOverride);
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
    const label = result.passed && !isSkip ? "PASS" : isSkip ? "SKIP" : `FAIL (${result.reason.slice(0, 120)})`;
    console.log(label);
  }

  // Reportamos o GERADOR (model under test) no relatório — é a variável que muda.
  // Juiz é constante (gpt-4.1-mini via router task "eval-judge").
  const reportedProvider = opts.generatorOverride?.provider ?? "router";
  const reportedModel = opts.generatorOverride?.model ?? "dre-narrative-route";

  return buildSummary({
    module: opts.module,
    evalMethod: "llm_as_judge",
    promptHash,
    provider: reportedProvider,
    model: reportedModel,
    passRateThreshold: opts.passRateThreshold,
    passRatePerOutcome: opts.passRatePerOutcome,
    totalCasesAll: relevantCases.length,
    cases: results,
    startedAt,
  });
}

// Quando há override de modelo (benchmark), bypass router/callLlm e Langfuse.
// Caso contrário, usa router de produção (com fallback + trace).
async function dispatchGenerator(
  override: { provider: LlmProvider; model: string } | undefined,
  req: LlmRequest,
): Promise<LlmResponse> {
  if (!override) return callLlm(req);
  const route = { provider: override.provider, model: override.model };
  switch (override.provider) {
    case "google":    return callGoogle(route, req);
    case "anthropic": return callAnthropic(route, req);
    case "openai":    return callOpenAI(route, req);
    case "groq":      return callGroq(route, req);
    default: throw new Error(`provider "${override.provider}" não suportado em override`);
  }
}

// ─── Dispatcher por (module, outcome) ─────────────────────────────────────────

async function executeCase(
  file: CaseFile,
  manifest: JudgeManifest,
  generatorOverride: { provider: LlmProvider; model: string } | undefined,
): Promise<CaseResult> {
  if (file.outcome === "dre_narrated") {
    return executeDreNarrated(file, manifest, generatorOverride);
  }
  return makeResult(
    file,
    true,
    `skipped:judge_not_implemented — outcome ${file.outcome} ainda não plugado em llm_as_judge`,
    "skipped",
    "n/a",
    0,
    0,
    0,
  );
}

// ─── Executor: dre_narrated ───────────────────────────────────────────────────

async function executeDreNarrated(
  file: CaseFile,
  manifest: JudgeManifest,
  generatorOverride: { provider: LlmProvider; model: string } | undefined,
): Promise<CaseResult> {
  // 1. Parse case
  const parsed = parseDreNarratedCase(file);

  // 2. Roda LLM gerador. Sem override = router de produção (Gemini 2.5 Flash) com
  //    fallback + trace Langfuse. Com override = adapter direto (benchmark mode,
  //    sem fallback nem trace — esperado pra comparativo de candidato).
  const generatorReq: LlmRequest = {
    task: "dre-narrative",
    systemPrompt: buildNarrativeSystemPrompt(),
    userPrompt: buildNarrativeUserPrompt({
      dre: parsed.dre,
      referenceMonth: parsed.referenceMonth,
      segment: parsed.segment,
      taxRegime: parsed.taxRegime,
      toneOfVoice: parsed.toneOfVoice,
    }),
    tenantId: "eval-runner",
    jsonMode: true,
  };
  const generator = await dispatchGenerator(generatorOverride, generatorReq);

  // 3. Sanity: tem que ser JSON parseável; senão é FAIL antes do juiz
  let cardsJson: unknown;
  try {
    cardsJson = JSON.parse(generator.content);
  } catch (err) {
    return makeResult(
      file,
      false,
      `generator_invalid_json: ${(err as Error).message.slice(0, 200)}`,
      generator.content.slice(0, 200),
      "valid JSON with cards[]",
      generator.inputTokens,
      generator.outputTokens,
      generator.costCents,
    );
  }

  // 4. Monta rubric + invoca judge
  const rubric = buildRubricFromCase(file, manifest);
  const judgePrompt = buildJudgePrompt({
    inputText: parsed.rawInput,
    output: generator.content,
    rubric,
    dimensions: manifest.judge_dimensions,
    scale: manifest.judge_scale,
  });

  const judge = await callLlm({
    task: "eval-judge",
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt: judgePrompt,
    tenantId: "eval-judge",
    jsonMode: true,
  });

  let judgeResp;
  try {
    judgeResp = JudgeResponseSchema.parse(JSON.parse(judge.content));
  } catch (err) {
    return makeResult(
      file,
      false,
      `judge_invalid_response: ${(err as Error).message.slice(0, 300)}`,
      generator.content.slice(0, 200),
      "judge JSON",
      generator.inputTokens + judge.inputTokens,
      generator.outputTokens + judge.outputTokens,
      generator.costCents + judge.costCents,
    );
  }

  // 5. Decide PASS/FAIL
  const failed: string[] = [];
  for (const dim of manifest.judge_dimensions) {
    const s = judgeResp.scores[dim];
    if (typeof s !== "number") {
      failed.push(`${dim}=missing`);
      continue;
    }
    if (s < manifest.judge_threshold_per_dim) {
      const why = judgeResp.justifications?.[dim] ?? "";
      failed.push(`${dim}=${s}<${manifest.judge_threshold_per_dim}${why ? `: ${why.slice(0, 80)}` : ""}`);
    }
  }

  // Decisão de PASS é só por scores. Violations entram em reason como informativo —
  // se o juiz julgou-as graves, já refletiu na nota da dimensão correspondente.
  // Esse arranjo evita que o juiz invente uma "violation" de borda e zere o resultado.
  const violations = judgeResp.violations ?? [];
  const passed = failed.length === 0;

  const scoresStr = manifest.judge_dimensions
    .map((d) => `${d}=${judgeResp.scores[d] ?? "?"}`)
    .join(", ");
  const violationSuffix = violations.length > 0
    ? ` [violations: ${violations.map((v) => v.slice(0, 80)).join(" | ")}]`
    : "";
  const reason = passed
    ? `ok (${scoresStr})${violationSuffix}`
    : failed.join("; ") + violationSuffix;

  return makeResult(
    file,
    passed,
    reason,
    JSON.stringify(judgeResp.scores),
    `>=${manifest.judge_threshold_per_dim} in ${manifest.judge_dimensions.join(",")}`,
    generator.inputTokens + judge.inputTokens,
    generator.outputTokens + judge.outputTokens,
    generator.costCents + judge.costCents,
  );
}

// ─── Parser do case dre_narrated ──────────────────────────────────────────────

interface ParsedDreNarratedCase {
  dre: DreLines;
  referenceMonth: string;
  segment: string;
  taxRegime: string;
  toneOfVoice: string;
  rawInput: string;
  groundTruthYaml: string;
}

function parseDreNarratedCase(file: CaseFile): ParsedDreNarratedCase {
  const inputBlock = extractSection(file.body, "Input");
  const gtBlock = extractSection(file.body, "Ground truth");

  // 1. Base: DRE expandida do case referenciado, quando houver "(vide dre-narrative-XXXX)"
  let dre = expandFromReferencedCase(inputBlock, file.filePath);

  // 2. Override: valores inline do próprio case (mais específicos que a base)
  dre = mergeInlineDre(dre, inputBlock);

  // Tenant line
  const segment = matchKv(inputBlock, "industrySegment") ?? "varejo";
  const taxRegime = matchKv(inputBlock, "taxRegime") ?? "lucroPresumido";
  const toneOfVoice = matchKv(inputBlock, "toneOfVoice") ?? "formal";

  // referenceMonth: "2026-04"
  const monthMatch = inputBlock.match(/referenceMonth:\s*"?([\d-]{7,10})"?/);
  const referenceMonth = monthMatch?.[1] ?? "2026-04";

  return { dre, referenceMonth, segment, taxRegime, toneOfVoice, rawInput: inputBlock.trim(), groundTruthYaml: gtBlock.trim() };
}

// Mapping de chaves do YAML "Ground truth" (case agregado) → DreLines.
// Mantido local pra evitar dependência cruzada com assertion-shape.ts.
const YAML_KEY_TO_DRELINE: Record<string, keyof DreLines> = {
  receitaBruta: "receitaBruta",
  deducoes: "deducoes",
  receitaLiquida: "receitaLiquida",
  cmv: "custosDiretos",
  custosDiretos: "custosDiretos",
  lucroBruto: "lucroBruto",
  margemBruta: "margemBruta",
  despesasPessoal: "despesasPessoal",
  prolabore: "prolabore",
  despesasAdm: "despesasAdm",
  despesasAdministrativas: "despesasAdm",
  despesasComerciais: "despesasComerciais",
  despesasTi: "despesasTi",
  despesasViagem: "despesasViagem",
  despesasJuridicas: "despesasJuridicas",
  despesasFinanceiras: "despesasFinanceiras",
  outrasDespesas: "outrasDespesas",
  outrasReceitasOp: "outrasReceitasOp",
  outrasReceitasOperacionais: "outrasReceitasOp",
  totalDespesasOp: "totalDespesasOp",
  totalDespesasOperacionais: "totalDespesasOp",
  ebitda: "ebitda",
  margemEbitda: "margemEbitda",
  depreciacao: "depreciacao",
  amortizacao: "amortizacao",
  ebit: "ebit",
  lucroOperacional: "ebit",
  margemOperacional: "margemOperacional",
  receitaFinanceira: "receitaFinanceira",
  receitasFinanceiras: "receitaFinanceira",
  resultadoFinanceiro: "resultadoFinanceiro",
  resultadoAntesImpostos: "resultadoAntesImpostos",
  lucroAntesIR: "resultadoAntesImpostos",
  impostos: "impostos",
  irCsll: "impostos",
  lucroLiquido: "lucroLiquido",
  margemLiquida: "margemLiquida",
  naoClassificado: "naoClassificado",
  emprestimosEntrada: "emprestimosEntrada",
  amortizacaoDividas: "amortizacaoDividas",
  capex: "capex",
  transferenciaInterna: "transferenciaInterna",
};

// Se o Input menciona "dre-narrative-XXXX" em qualquer formato suportado, expande
// DRE a partir do YAML do Ground truth do case referenciado. Formatos aceitos:
//   - "(vide dre-narrative-0001)"
//   - "idêntico ao dre-narrative-0008"
//   - "idêntico em valores ... dre-narrative-0009"
// Self-references são ignoradas. Retorna DreLines zerada se não houver match.
function expandFromReferencedCase(inputBlock: string, currentFilePath: string): DreLines {
  const refs = [...inputBlock.matchAll(/(dre-narrative-\d{4})/g)].map((m) => m[1]).filter(Boolean) as string[];
  const selfId = (currentFilePath.match(/(dre-narrative-\d{4})\.md$/)?.[1]) ?? "";
  const target = refs.find((id) => id !== selfId);
  if (!target) return emptyDreLines();

  const refPath = join(resolve(currentFilePath, ".."), `${target}.md`);
  let raw: string;
  try {
    raw = readFileSync(refPath, "utf-8");
  } catch {
    return emptyDreLines();
  }

  const gtMatch = raw.match(/##\s*Ground truth[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  const gtBlock = gtMatch?.[1] ?? "";
  const yamlMatch = gtBlock.match(/```yaml\s*\n([\s\S]*?)\n```/);
  const yamlBody = yamlMatch?.[1] ?? gtBlock;

  const dre = emptyDreLines();
  for (const line of yamlBody.split("\n")) {
    const noComment = line.replace(/#.*$/, "").trim();
    if (!noComment) continue;
    const colon = noComment.indexOf(":");
    if (colon === -1) continue;
    const key = noComment.slice(0, colon).trim();
    const valueStr = noComment.slice(colon + 1).trim();
    if (!valueStr) continue;
    const dreKey = YAML_KEY_TO_DRELINE[key];
    if (!dreKey) continue;
    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;
    dre[dreKey] = value;
  }
  return dre;
}

function emptyDreLines(): DreLines {
  return {
    receitaBruta: 0, deducoes: 0, receitaLiquida: 0,
    custosDiretos: 0, lucroBruto: 0, margemBruta: 0,
    despesasPessoal: 0, prolabore: 0, despesasAdm: 0,
    despesasComerciais: 0, despesasTi: 0, despesasViagem: 0, despesasJuridicas: 0,
    despesasFinanceiras: 0, outrasDespesas: 0, outrasReceitasOp: 0,
    totalDespesasOp: 0, ebitda: 0, margemEbitda: 0,
    depreciacao: 0, amortizacao: 0, ebit: 0, margemOperacional: 0,
    receitaFinanceira: 0, resultadoFinanceiro: 0,
    resultadoAntesImpostos: 0, impostos: 0, lucroLiquido: 0, margemLiquida: 0,
    naoClassificado: 0,
    emprestimosEntrada: 0, amortizacaoDividas: 0, capex: 0, transferenciaInterna: 0,
  };
}

function extractSection(body: string, header: string): string {
  const re = new RegExp(`##\\s*${header}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const m = body.match(re);
  if (!m || !m[1]) throw new Error(`Sem bloco "## ${header}"`);
  return m[1];
}

function matchKv(block: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*=\\s*([a-zA-Z][a-zA-Z0-9_-]*)`);
  const m = block.match(re);
  return m?.[1] ?? null;
}

// Override: aplica valores inline ("receitaBruta=R$ 100.000,00; margemBruta=47,37%; ...")
// sobre uma DRE base (vinda do case referenciado). Inline tem prioridade.
function mergeInlineDre(base: DreLines, block: string): DreLines {
  const out = { ...base };
  for (const segment of block.split(/[;\n]/)) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const keyPart = segment.slice(0, eq).trim();
    const valuePart = segment.slice(eq + 1).trim();
    const words = keyPart.match(/[a-zA-Z][a-zA-Z0-9]*/g) ?? [];
    const found = words.find((w) => w in YAML_KEY_TO_DRELINE);
    if (!found) continue;
    const dreKey = YAML_KEY_TO_DRELINE[found]!;

    const isPct = /%/.test(valuePart) || /margem/i.test(dreKey);
    if (isPct) {
      const num = parsePctOrNumber(valuePart);
      if (num !== null) out[dreKey] = num;
    } else {
      const cents = parseBrlToCents(valuePart);
      if (cents !== 0) out[dreKey] = cents;
    }
  }
  return out;
}

function parsePctOrNumber(raw: string): number | null {
  const cleaned = raw.replace(/%/g, "").trim();
  const num = /^-?(?:\d{1,3}(?:\.\d{3})*,\d{1,4}|\d+(?:[,.]\d{1,4})?)/.exec(cleaned);
  if (!num) return null;
  const norm = num[0].replace(/\./g, "").replace(",", ".");
  const v = parseFloat(norm);
  return isNaN(v) ? null : v;
}

function parseBrlToCents(raw: string): number {
  const cleaned = raw.replace(/^R\$\s*/, "").trim();
  if (!cleaned) return 0;
  const numMatch = /^-?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)/.exec(cleaned);
  if (!numMatch) return 0;
  const normalized = numMatch[0].replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : Math.round(value * 100);
}

// ─── Judge prompt builder ─────────────────────────────────────────────────────

const JUDGE_SYSTEM_PROMPT = `Você é um avaliador especialista em LLM-as-judge para análises financeiras de PMEs brasileiras.
Sua função: dar nota objetiva (1-5) por dimensão a partir de uma rubrica explícita, sem inventar critérios.

CONTRATO DE UNIDADES DO OUTPUT (regras do produto Aicfo — você DEVE conhecer):
- O OUTPUT a avaliar é um JSON com cards[]. Cada card tem evidence[] = [{ metric, value, unit }].
- Quando unit="R$", o campo "value" está em CENTAVOS (inteiros). Exemplos:
    value=5000000 unit="R$"   → R$ 50.000,00
    value=10000000 unit="R$"  → R$ 100.000,00
    value=-380000 unit="R$"   → −R$ 3.800,00
- Quando unit="%", o campo "value" está em CENTI-PORCENTO (basis points / 100). Exemplos:
    value=1500 unit="%"   → 15,00%
    value=4737 unit="%"   → 47,37%
    value=-500 unit="%"   → −5,00%
- O INPUT que aparece abaixo da rubrica está em formato humano ("receitaBruta=R$ 100.000,00", "margemLiquida=15,00%"). Os valores DEVEM bater com o OUTPUT após conversão. NÃO trate centavos ou centi-porcento como erro.

REGRAS DE PONTUAÇÃO (1-5 por dimensão):
- 5: excelente; atende plenamente todos os pontos da definição
- 4: bom; pequenos pontos de melhoria, mas atende o essencial
- 3: aceitável; uma deficiência relevante
- 2: ruim; duas ou mais deficiências relevantes
- 1: inaceitável; falha grave (alucinação, contradição com input após conversão de unidade, regra explícita violada)

VIOLATIONS:
- Liste APENAS violações que você verificou de fato no output. Não invente.
- Não liste uma "violação" só pra cobrir bases — se você escrever "não há violação direta detectada" é porque não é violação. Não inclua.
- Cada violation cita: regra violada + trecho do output que viola.

Justificativas: 1 frase curta, citando trecho do output quando aplicável.

RESPONDA APENAS JSON VÁLIDO no formato:
{
  "scores": { "<dim>": <int 1-5>, ... },
  "justifications": { "<dim>": "<frase>", ... },
  "violations": ["<descrição da violação>", ...]
}`;

interface JudgePromptArgs {
  inputText: string;
  output: string;
  rubric: string;
  dimensions: string[];
  scale: string;
}

function buildJudgePrompt(args: JudgePromptArgs): string {
  return `DIMENSÕES A AVALIAR (escala ${args.scale}):
${args.dimensions.map((d) => `- ${d}`).join("\n")}

RUBRICA (do case):
${args.rubric}

INPUT FORNECIDO À LLM AVALIADA:
${args.inputText}

OUTPUT DA LLM A AVALIAR (JSON):
${args.output}

Avalie estritamente segundo a rubrica acima. Retorne apenas o JSON.`;
}

function buildRubricFromCase(file: CaseFile, manifest: JudgeManifest): string {
  // Extrai bloco yaml de Ground truth e mantém apenas chaves relevantes pro juiz.
  const gtBlock = extractSection(file.body, "Ground truth");
  const yamlMatch = gtBlock.match(/```yaml\s*\n([\s\S]*?)\n```/);
  const yamlBody = yamlMatch?.[1] ?? gtBlock;

  const lines: string[] = [];
  lines.push("Dimensões pontuáveis (defina nota 1-5):");
  for (const dim of manifest.judge_dimensions) {
    lines.push(`- ${dim}: ver descrição em judge_criteria.${dim}`);
  }
  lines.push("");
  lines.push("Critérios + regras adicionais (YAML do case):");
  lines.push(yamlBody.trim());
  return lines.join("\n");
}

// ─── Schema da resposta do juiz ───────────────────────────────────────────────

const JudgeResponseSchema = z.object({
  scores: z.record(z.string(), z.number().int().min(1).max(5)),
  justifications: z.record(z.string(), z.string()).optional(),
  violations: z.array(z.string()).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(
  file: CaseFile,
  passed: boolean,
  reason: string,
  predicted: string | null,
  expected: string | null,
  inputTokens: number,
  outputTokens: number,
  costCents: number,
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
    inputTokens,
    outputTokens,
    costCents,
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
