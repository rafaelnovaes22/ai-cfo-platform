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
import {
  buildActionPlanSystemPrompt,
  buildActionPlanUserPrompt,
} from "@/action-plan/prompts.js";
import { parsePlanResponse } from "@/action-plan/generator.js";
import { normalizeActionPlanActions } from "@/action-plan/postprocess.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import { normalizeNarrativeCards } from "@/dre-narrative/postprocess.js";
import { runNarrativeSynthesisAgentWithTelemetry } from "@/monthly-analysis/agents/narrative-synthesis.js";
import { runActionPlanningAgentWithTelemetry } from "@/monthly-analysis/agents/action-planning.js";
import { buildUserPrompt as buildGraphNarrativeUserPrompt } from "@/monthly-analysis/agents/prompts/narrative-synthesis.js";
import { buildUserPrompt as buildGraphActionUserPrompt } from "@/monthly-analysis/agents/prompts/action-planning.js";
import { parseNarrativeSynthesisInput, parseActionPlanningInput } from "./assertion-shape.js";
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

const NarrativeEvalResponseSchema = z.object({
  cards: z.array(z.object({
    type: z.enum(["critical_gap", "attention", "healthy"]),
    title: z.string(),
    body: z.string(),
    evidence: z.array(z.object({
      metric: z.string(),
      value: z.number(),
      unit: z.string(),
    })),
  })).length(3),
});

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

// Quando há override de modelo (benchmark), bypass router/callLlm e tracing.
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
  if (file.outcome === "plan_generated") {
    return executeActionPlanGenerated(file, manifest, generatorOverride);
  }
  // Agentes do grafo monthly-analysis (proxy de qualidade, signal não-bloqueante):
  // roda o agente REAL do grafo e julga o output com as judge_dimensions do manifest.
  if (file.module === "monthly-analysis/narrative-synthesis") {
    return executeGraphNarrative(file, manifest);
  }
  if (file.module === "monthly-analysis/action-planning") {
    return executeGraphActionPlan(file, manifest);
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

// ─── Executores: agentes do grafo monthly-analysis ───────────────────────────

// O llm_as_judge avalia QUALIDADE DE CONTEÚDO; o schema/estrutura já é validado
// pelo assertion_shape. Estas notas dizem ao juiz o schema REAL de cada agente do
// grafo, para ele não penalizar nomes de campos (as rubricas dos cases descrevem
// um schema antigo com "narrative"/"severity" que não existem mais).
const NARRATIVE_SCHEMA_NOTE = `SCHEMA DO OUTPUT (agente narrative-synthesis): cada card é { type, title, body, evidenceRefs }. O texto narrativo está em "body"; NÃO existem campos "narrative" nem "severity". A validação de schema/campos é feita por outro método — NÃO penalize nomes de campo nem campos "ausentes" fora deste schema. Avalie APENAS a qualidade de conteúdo nas dimensões dadas (factualidade dos números vs INPUT, clareza executiva, uso das evidências em evidenceRefs/body, tom).`;
const ACTION_SCHEMA_NOTE = `SCHEMA DO OUTPUT (agente action-planning): { actions: [{ horizon, title, description, effortLevel, riskLevel, impactCents, deadlineDays, doneWhen, evidenceRefs, confidence }] }. impactCents está em CENTAVOS. A validação de schema é feita por outro método — NÃO penalize nomes/estrutura de campos. Avalie APENAS a qualidade de conteúdo nas dimensões dadas (acionabilidade, plausibilidade do impacto vs receita, doneWhen executável, evidenceRefs válidos).`;

async function executeGraphNarrative(file: CaseFile, manifest: JudgeManifest): Promise<CaseResult> {
  const input = parseNarrativeSynthesisInput(file);
  const { data: cards, response: generator } = await runNarrativeSynthesisAgentWithTelemetry(
    input,
    { tenantId: "eval-runner" },
  );
  // inputText = o MESMO prompt formatado (em reais) que o agente recebeu, para o
  // juiz comparar factualidade na mesma unidade — não o DRE cru em centavos.
  return judgeGraphOutput(file, manifest, buildGraphNarrativeUserPrompt(input), JSON.stringify({ cards }), generator, NARRATIVE_SCHEMA_NOTE);
}

async function executeGraphActionPlan(file: CaseFile, manifest: JudgeManifest): Promise<CaseResult> {
  const input = parseActionPlanningInput(file);
  const { data: plan, response: generator } = await runActionPlanningAgentWithTelemetry(
    input,
    { tenantId: "eval-runner" },
  );
  return judgeGraphOutput(file, manifest, buildGraphActionUserPrompt(input), JSON.stringify(plan), generator, ACTION_SCHEMA_NOTE);
}

// Julga o output de um agente do grafo (já gerado) com o LLM-juiz, reusando a
// rubrica/dimensões do manifest. Retry uma vez se o juiz devolver JSON inválido.
async function judgeGraphOutput(
  file: CaseFile,
  manifest: JudgeManifest,
  inputText: string,
  output: string,
  generator: LlmResponse,
  schemaNote?: string,
): Promise<CaseResult> {
  const rubric = buildRubricFromCase(file, manifest);
  const judgePrompt = buildJudgePrompt({
    inputText,
    output,
    rubric,
    dimensions: manifest.judge_dimensions,
    scale: manifest.judge_scale,
    schemaNote,
  });

  const judge = await callLlm({
    task: "eval-judge",
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt: judgePrompt,
    tenantId: "eval-judge",
    jsonMode: true,
  });

  try {
    const judgeResp = JudgeResponseSchema.parse(JSON.parse(judge.content));
    return makeJudgeScoredResult(file, manifest, judgeResp, generator, judge);
  } catch (err) {
    const retryJudge = await callLlm({
      task: "eval-judge",
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt: `${judgePrompt}\n\nRETORNE APENAS JSON valido, sem markdown e sem aspas nao escapadas dentro de strings.`,
      tenantId: "eval-judge",
      jsonMode: true,
    });
    const merged = {
      ...retryJudge,
      inputTokens: judge.inputTokens + retryJudge.inputTokens,
      outputTokens: judge.outputTokens + retryJudge.outputTokens,
      costCents: judge.costCents + retryJudge.costCents,
    };
    try {
      const judgeResp = JudgeResponseSchema.parse(JSON.parse(retryJudge.content));
      return makeJudgeScoredResult(file, manifest, judgeResp, generator, merged);
    } catch {
      return makeResult(
        file,
        false,
        `judge_invalid_response: ${(err as Error).message.slice(0, 300)}`,
        output.slice(0, 200),
        "judge JSON",
        generator.inputTokens + merged.inputTokens,
        generator.outputTokens + merged.outputTokens,
        generator.costCents + merged.costCents,
      );
    }
  }
}

// ─── Executor: dre_narrated ───────────────────────────────────────────────────

async function executeActionPlanGenerated(
  file: CaseFile,
  manifest: JudgeManifest,
  generatorOverride: { provider: LlmProvider; model: string } | undefined,
): Promise<CaseResult> {
  const parsed = parseActionPlanCase(file);

  const generatorReq: LlmRequest = {
    task: "action-plan",
    systemPrompt: buildActionPlanSystemPrompt(),
    userPrompt: buildActionPlanUserPrompt({
      dre: parsed.dre,
      referenceMonth: parsed.referenceMonth,
      segment: parsed.segment,
      taxRegime: parsed.taxRegime,
      toneOfVoice: parsed.toneOfVoice,
      narrativeCards: parsed.narrativeCards,
    }),
    tenantId: "eval-runner",
    jsonMode: true,
  };
  const generator = await dispatchGenerator(generatorOverride, generatorReq);

  let planJson: unknown;
  try {
    planJson = JSON.parse(generator.content);
  } catch (err) {
    return makeResult(
      file,
      false,
      `generator_invalid_json: ${(err as Error).message.slice(0, 200)}`,
      generator.content.slice(0, 200),
      "valid JSON with actions[]",
      generator.inputTokens,
      generator.outputTokens,
      generator.costCents,
    );
  }

  try {
    const parsedPlan = parsePlanResponse(planJson);
    planJson = {
      actions: normalizeActionPlanActions(
        parsedPlan.actions,
        parsed.dre,
        parsed.segment,
        parsed.narrativeCards.map((card) => `${card.title}\n${card.body}`).join("\n"),
      ),
    };
  } catch (err) {
    return makeResult(
      file,
      false,
      `generator_invalid_shape: ${(err as Error).message.slice(0, 300)}`,
      generator.content.slice(0, 200),
      "parsePlanResponse",
      generator.inputTokens,
      generator.outputTokens,
      generator.costCents,
    );
  }

  const rubric = buildRubricFromCase(file, manifest);
  const judgePrompt = buildJudgePrompt({
    inputText: generatorReq.userPrompt,
    output: JSON.stringify(planJson),
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
    const retryJudge = await callLlm({
      task: "eval-judge",
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt: `${judgePrompt}\n\nRETORNE APENAS JSON valido, sem markdown e sem aspas nao escapadas dentro de strings.`,
      tenantId: "eval-judge",
      jsonMode: true,
    });
    try {
      judgeResp = JudgeResponseSchema.parse(JSON.parse(retryJudge.content));
      return makeJudgeScoredResult(file, manifest, judgeResp, generator, {
        ...retryJudge,
        inputTokens: judge.inputTokens + retryJudge.inputTokens,
        outputTokens: judge.outputTokens + retryJudge.outputTokens,
        costCents: judge.costCents + retryJudge.costCents,
      });
    } catch {
      return makeResult(
        file,
        false,
        `judge_invalid_response: ${(err as Error).message.slice(0, 300)}`,
        generator.content.slice(0, 200),
        "judge JSON",
        generator.inputTokens + judge.inputTokens + retryJudge.inputTokens,
        generator.outputTokens + judge.outputTokens + retryJudge.outputTokens,
        generator.costCents + judge.costCents + retryJudge.costCents,
      );
    }
  }

  return makeJudgeScoredResult(file, manifest, judgeResp, generator, judge);
}

async function executeDreNarrated(
  file: CaseFile,
  manifest: JudgeManifest,
  generatorOverride: { provider: LlmProvider; model: string } | undefined,
): Promise<CaseResult> {
  // 1. Parse case
  const parsed = parseDreNarratedCase(file);

  // 2. Roda LLM gerador. Sem override = router de produção (Gemini 2.5 Flash) com
  //    fallback + trace LangSmith. Com override = adapter direto (benchmark mode,
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
  let parsedCards: z.infer<typeof NarrativeEvalResponseSchema>;
  try {
    parsedCards = NarrativeEvalResponseSchema.parse(cardsJson);
  } catch (err) {
    return makeResult(
      file,
      false,
      `generator_invalid_shape: ${(err as Error).message.slice(0, 200)}`,
      generator.content.slice(0, 200),
      "valid JSON with exactly 3 cards",
      generator.inputTokens,
      generator.outputTokens,
      generator.costCents,
    );
  }
  const normalizedCards = normalizeNarrativeCards(parsedCards.cards, parsed.dre, parsed.segment, parsed.toneOfVoice);
  const normalizedContent = JSON.stringify({ cards: normalizedCards });

  // 4. Monta rubric + invoca judge.
  // inputText = prompt completo que o gerador recebeu (DRE formatada + tenant context),
  // não o rawInput do case. Isso permite que o judge verifique factualidade contra o
  // mesmo texto que o gerador viu — e não contra o input abreviado do case file.
  const rubric = buildRubricFromCase(file, manifest);
  const judgePrompt = buildJudgePrompt({
    inputText: generatorReq.userPrompt,
    output: normalizedContent,
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

interface ParsedActionPlanCase {
  dre: DreLines;
  referenceMonth: string;
  segment: string;
  taxRegime: string;
  toneOfVoice: string;
  narrativeCards: Array<{ type: string; title: string; body: string }>;
}

function parseActionPlanCase(file: CaseFile): ParsedActionPlanCase {
  const inputBlock = extractSection(file.body, "Input");
  let dre = expandFromReferencedCase(inputBlock, file.filePath);
  dre = mergeInlineDre(dre, inputBlock);
  dre = mergeLooseActionPlanDre(dre, inputBlock);
  if (dre.receitaBruta === 0 && /(DRE:\s*v\S*lido|saud\S*vel|igual ao action-plan-0001|id\S*ntic\S* ao action-plan-0001)/i.test(inputBlock)) {
    dre = defaultHealthyActionPlanDre(dre);
  }

  const segment = matchKv(inputBlock, "industrySegment") ?? "geral";
  const taxRegime = matchKv(inputBlock, "taxRegime") ?? "simples";
  const toneOfVoice = matchKv(inputBlock, "toneOfVoice") ?? "formal";
  const monthMatch = inputBlock.match(/referenceMonth:\s*"?([\d-]{7,10})"?/);
  const referenceMonth = monthMatch?.[1] ?? "2026-04";

  const cardsMatch = inputBlock.match(/Narr?ativeCards:\s*(.+)$/im);
  const cardsText = cardsMatch?.[1] ?? inputBlock;
  const titleMatches = [...cardsText.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]).filter(Boolean) as string[];
  const narrativeCards = (titleMatches.length > 0 ? titleMatches : ["Leitura financeira do mes"])
    .slice(0, 3)
    .map((title, idx) => ({
      type: idx === 0 ? "critical_gap" : idx === 1 ? "attention" : "healthy",
      title,
      body: cardsText,
    }));

  return { dre, referenceMonth, segment, taxRegime, toneOfVoice, narrativeCards };
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

function defaultHealthyActionPlanDre(base: DreLines): DreLines {
  return {
    ...base,
    receitaBruta: 100_000_00,
    receitaLiquida: 95_000_00,
    custosDiretos: 50_000_00,
    lucroBruto: 45_000_00,
    margemBruta: 47.37,
    ebitda: 22_000_00,
    ebit: 22_000_00,
    despesasFinanceiras: 2_000_00,
    lucroLiquido: 14_250_00,
    margemLiquida: 15,
  };
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
    if (keyPart.includes("/")) continue;
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

function mergeLooseActionPlanDre(base: DreLines, block: string): DreLines {
  const out = { ...base };
  const aliases: Array<[RegExp, keyof DreLines, "money" | "pct"]> = [
    [/\breceitaBruta\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "receitaBruta", "money"],
    [/\breceitaLiquida\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "receitaLiquida", "money"],
    [/\bcmv\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "custosDiretos", "money"],
    [/\bcustosDiretos\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "custosDiretos", "money"],
    [/\bebitda\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "ebitda", "money"],
    [/\blucroLiquido\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "lucroLiquido", "money"],
    [/\bdespesasPessoal\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "despesasPessoal", "money"],
    [/\bdespesasAdministrativas\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "despesasAdm", "money"],
    [/\bdespesasComerciais\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "despesasComerciais", "money"],
    [/\bnaoClassificado\s+(-?R\$\s*[\d.,]+[kKmM]?)/i, "naoClassificado", "money"],
    [/\bmargemLiquida\s+(-?\d+(?:[,.]\d+)?%?)/i, "margemLiquida", "pct"],
  ];
  for (const [regex, key, kind] of aliases) {
    const match = block.match(regex);
    if (!match?.[1]) continue;
    if (kind === "money") {
      const cents = parseLooseMoneyToCents(match[1]);
      if (cents !== null) out[key] = cents;
    } else {
      const value = parsePctOrNumber(match[1]);
      if (value !== null) out[key] = value <= 1 && !match[1].includes("%") ? value * 100 : value;
    }
  }

  if (out.receitaLiquida === 0 && out.receitaBruta !== 0) out.receitaLiquida = out.receitaBruta;
  if (out.lucroBruto === 0 && out.receitaLiquida !== 0) out.lucroBruto = out.receitaLiquida - out.custosDiretos;
  if (out.margemBruta === 0 && out.receitaLiquida !== 0 && out.lucroBruto !== 0) {
    out.margemBruta = Math.round((out.lucroBruto / out.receitaLiquida) * 10000) / 100;
  }
  if (out.ebit === 0 && out.ebitda !== 0) out.ebit = out.ebitda;
  if (out.totalDespesasOp === 0) {
    out.totalDespesasOp = out.despesasPessoal + out.despesasAdm + out.despesasComerciais;
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

function parseLooseMoneyToCents(raw: string): number | null {
  const match = raw.match(/(-?)R\$\s*([\d.,]+)\s*([km])?/i);
  if (!match?.[2]) return null;
  const normalized = match[2].replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return null;
  const multiplier = match[3]?.toLowerCase() === "m" ? 1_000_000 : match[3]?.toLowerCase() === "k" ? 1_000 : 1;
  return Math.round(value * multiplier * 100) * (match[1] === "-" ? -1 : 1);
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
- Quando unit="R$", o campo "value" está em REAIS como número decimal. Exemplos:
    value=50000.00 unit="R$"  → R$ 50.000,00
    value=100000.00 unit="R$" → R$ 100.000,00
    value=2000.00 unit="R$"   → R$ 2.000,00
    value=14250.00 unit="R$"  → R$ 14.250,00
- Quando unit="%", o campo "value" é a porcentagem como número decimal. Exemplos:
    value=15.00 unit="%"  → 15,00%
    value=47.37 unit="%"  → 47,37%
    value=5.00 unit="%"   → 5,00%
- O INPUT que aparece abaixo da rubrica está em formato humano ("receitaBruta=R$ 100.000,00", "margemLiquida=15,00%"). Os valores DEVEM bater com o OUTPUT. NÃO penalize arredondamentos de centavos (ex: 14250 vs 14250.00).

INTERPRETAÇÃO DA RUBRICA
- required_metrics_in_evidence: [X, Y] — ao menos UM card deve ter X em evidence; ao menos UM card deve ter Y. Não exige que TODOS os cards tenham X ou Y — cards diferentes cobrem métricas diferentes.
- critical_gap_card.must_reference: [A, B] — o card critical_gap especificamente deve incluir A e B em evidence.
- attention_card.must_reference: [A] — o card attention especificamente deve incluir A em evidence.
- healthy_card.must_mention_metric: [A] — o card healthy deve mencionar A no body ou evidence.
- forbidden_terms: ["EBITDA"] — nenhuma palavra proibida pode aparecer em body, title ou metric name de nenhum card.

REGRAS DE PONTUAÇÃO (1-5 por dimensão):
- 5: excelente; atende plenamente todos os pontos da definição
- 4: bom; pequenos pontos de melhoria, mas atende o essencial
- 3: aceitável; uma deficiência relevante
- 2: ruim; duas ou mais deficiências relevantes
- 1: inaceitável; falha grave (alucinação comprovada, contradição com input, regra explícita violada)

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
  schemaNote?: string;
}

function buildJudgePrompt(args: JudgePromptArgs): string {
  return `DIMENSÕES A AVALIAR (escala ${args.scale}):
${args.dimensions.map((d) => `- ${d}`).join("\n")}
${args.schemaNote ? `\n${args.schemaNote}\n` : ""}

CONTRATO DE UNIDADES PARA ACTION-PLAN:
- Se o OUTPUT tiver actions[].impactCents, esse campo esta em CENTAVOS.
- Exemplos: impactCents=400000 => R$ 4.000; impactCents=250000 => R$ 2.500; impactCents=50000000 => R$ 500.000.
- Ao avaliar impacto_plausivel, sempre converta impactCents para reais antes de comparar com receitaBruta.

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

function makeJudgeScoredResult(
  file: CaseFile,
  manifest: JudgeManifest,
  judgeResp: z.infer<typeof JudgeResponseSchema>,
  generator: LlmResponse,
  judge: LlmResponse,
): CaseResult {
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
