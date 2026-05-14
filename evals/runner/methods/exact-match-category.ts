import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import { resolveRoute } from "@/llm/router.js";
import { callGoogle } from "@/llm/adapters/google.js";
import { callAnthropic } from "@/llm/adapters/anthropic.js";
import { callOpenAI } from "@/llm/adapters/openai.js";
import { buildSystemPrompt, buildUserPrompt } from "@/classification/prompts.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "@/llm/types.js";
import { loadCases, parseClassificationCase } from "../case-loader.js";
import { hashPrompt } from "../prompt-hash.js";
import type { BucketSummary, CaseResult, RunSummary } from "../types.js";

const ResponseSchema = z.array(
  z.object({
    entryId: z.string(),
    category: z.string(),
    confidence: z.number().min(0).max(1),
  }),
);

interface RunOptions {
  module: string;
  passRateThreshold: number;
  passRatePerOutcome?: Record<string, number>;
  maxCases?: number;
  modelOverride?: { provider: LlmProvider; model: string };
}

export async function runExactMatchCategory(opts: RunOptions): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const allCases = loadCases(opts.module);
  const cases = typeof opts.maxCases === "number" ? allCases.slice(0, opts.maxCases) : allCases;

  const systemPrompt = buildSystemPrompt();
  const promptHash = hashPrompt(systemPrompt);
  const route = opts.modelOverride
    ? { provider: opts.modelOverride.provider, model: opts.modelOverride.model }
    : resolveRoute("classification");

  const results: CaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const file = cases[i];
    if (!file) continue;
    process.stdout.write(`  [${i + 1}/${cases.length}] ${file.caseId} ... `);

    let parsed;
    try {
      parsed = parseClassificationCase(file);
    } catch (err) {
      results.push(failResult(file.caseId, file.outcome, file.sourceMode, `parse_error: ${(err as Error).message}`));
      console.log("PARSE-ERR");
      continue;
    }

    const userPrompt = buildUserPrompt([
      {
        entryId: parsed.meta.caseId,
        date: parsed.input.date,
        description: parsed.input.description,
        amountCents: parsed.input.amountCents,
        direction: parsed.input.direction,
      },
    ]);

    const t0 = Date.now();
    let llmResponse;
    try {
      llmResponse = await dispatchLlm(opts.modelOverride ?? null, {
        task: "classification",
        systemPrompt,
        userPrompt,
        tenantId: "eval-runner",
        jsonMode: true,
      });
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        ...failBase(file.caseId, file.outcome, file.sourceMode),
        reason: `llm_error: ${errMsg.slice(0, 500)}`,
        latencyMs,
      });
      console.log(`LLM-ERR: ${errMsg.slice(0, 300)}`);
      continue;
    }
    const latencyMs = Date.now() - t0;

    let response;
    try {
      response = ResponseSchema.parse(JSON.parse(llmResponse.content));
    } catch (err) {
      results.push({
        ...failBase(file.caseId, file.outcome, file.sourceMode),
        reason: `parse_response_error: ${(err as Error).message.slice(0, 500)}`,
        latencyMs,
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
        costCents: llmResponse.costCents,
      });
      console.log("PARSE-RES-ERR");
      continue;
    }

    const item = response[0];
    if (!item) {
      results.push({
        ...failBase(file.caseId, file.outcome, file.sourceMode),
        reason: "empty_response",
        latencyMs,
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
        costCents: llmResponse.costCents,
      });
      console.log("EMPTY");
      continue;
    }

    // Avaliação
    const { expectedCategory, expectedConfidenceMin, expectedConfidenceMax, acceptableAlternatives } = parsed.groundTruth;
    const acceptedSet = new Set<string>([expectedCategory, ...acceptableAlternatives]);

    // Sanitiza categoria como o classifier de produção faz (DRE_CATEGORIES é a fonte da verdade)
    const sanitizedPredicted = DRE_CATEGORIES.includes(item.category as never) ? item.category : "nao_classificado";

    const categoryMatches = acceptedSet.has(sanitizedPredicted);

    const confidenceOk = checkConfidence(
      item.confidence,
      expectedConfidenceMin,
      expectedConfidenceMax,
    );

    const passed = categoryMatches && confidenceOk.ok;
    const reason = passed
      ? "ok"
      : !categoryMatches
        ? `category_mismatch: predicted=${sanitizedPredicted} expected=${expectedCategory}`
        : `confidence_out_of_range: ${item.confidence.toFixed(2)} — ${confidenceOk.reason}`;

    results.push({
      caseId: file.caseId,
      outcome: file.outcome,
      sourceMode: file.sourceMode,
      passed,
      predicted: sanitizedPredicted,
      expected: expectedCategory,
      confidence: item.confidence,
      reason,
      latencyMs,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      costCents: llmResponse.costCents,
    });
    console.log(passed ? "PASS" : `FAIL (${reason})`);
  }

  return buildSummary({
    module: opts.module,
    evalMethod: "exact_match_category",
    promptHash,
    provider: route.provider,
    model: route.model,
    passRateThreshold: opts.passRateThreshold,
    passRatePerOutcome: opts.passRatePerOutcome,
    totalCasesAll: allCases.length,
    cases: results,
    startedAt,
  });
}

// Quando há override de modelo (eval comparativo), bypass callLlm e Langfuse.
// Caso contrário usa o router de produção via callLlm (com trace).
async function dispatchLlm(
  override: { provider: LlmProvider; model: string } | null,
  req: LlmRequest,
): Promise<LlmResponse> {
  if (!override) return callLlm(req);
  const route = { provider: override.provider, model: override.model };
  switch (override.provider) {
    case "google":    return callGoogle(route, req);
    case "anthropic": return callAnthropic(route, req);
    case "openai":    return callOpenAI(route, req);
    default: throw new Error(`provider "${override.provider}" não suportado em override`);
  }
}

function checkConfidence(
  actual: number,
  min: number | undefined,
  max: number | undefined,
): { ok: boolean; reason: string } {
  if (typeof min === "number" && actual < min) return { ok: false, reason: `below min ${min}` };
  if (typeof max === "number" && actual > max) return { ok: false, reason: `above max ${max}` };
  return { ok: true, reason: "" };
}

function failBase(caseId: string, outcome: string, sourceMode: string): CaseResult {
  return {
    caseId,
    outcome,
    sourceMode,
    passed: false,
    predicted: null,
    expected: null,
    confidence: null,
    reason: "",
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
  };
}

function failResult(caseId: string, outcome: string, sourceMode: string, reason: string): CaseResult {
  return { ...failBase(caseId, outcome, sourceMode), reason };
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
  const passed = args.cases.filter((c) => c.passed).length;
  const failed = args.cases.length - passed;
  const passRate = args.cases.length === 0 ? 0 : passed / args.cases.length;
  const totalCostCents = args.cases.reduce((s, c) => s + c.costCents, 0);
  const totalLatencyMs = args.cases.reduce((s, c) => s + c.latencyMs, 0);

  const byOutcome = bucketize(args.cases, (c) => c.outcome);
  const bySourceMode = bucketize(args.cases, (c) => c.sourceMode);

  // Anota threshold por outcome quando declarado e calcula thresholdMet overall
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
    attemptedCases: args.cases.length,
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
