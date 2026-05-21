// Eval LLM runner — executa cases contra prompts vigentes via LLM real.
// Uso: tsx --env-file=.env evals/run-llm.ts --module=<key> [--max-cases=N] [--no-write]
//
// Dispatch por manifest.eval_method / eval_methods.
// Métodos suportados: exact_match_category, assertion_shape, llm_as_judge.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runExactMatchCategory } from "./runner/methods/exact-match-category.js";
import { runAssertionShape } from "./runner/methods/assertion-shape.js";
import { runLlmAsJudge } from "./runner/methods/llm-as-judge.js";
import { writeRunReport } from "./runner/report.js";
import type { RunSummary } from "./runner/types.js";

import type { LlmProvider } from "@/llm/types.js";

interface CliArgs {
  module: string;
  maxCases: number | undefined;
  write: boolean;
  provider: LlmProvider | undefined;
  model: string | undefined;
  method: string | undefined;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let module: string | undefined;
  let maxCases: number | undefined;
  let write = true;
  let provider: LlmProvider | undefined;
  let model: string | undefined;
  let method: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--module=")) module = arg.slice("--module=".length);
    else if (arg === "--module") module = args[args.indexOf(arg) + 1];
    else if (arg.startsWith("--max-cases=")) maxCases = Number(arg.slice("--max-cases=".length));
    else if (arg === "--no-write") write = false;
    else if (arg.startsWith("--provider=")) provider = arg.slice("--provider=".length) as LlmProvider;
    else if (arg.startsWith("--model=")) model = arg.slice("--model=".length);
    else if (arg.startsWith("--method=")) method = arg.slice("--method=".length);
  }

  if (!module) {
    console.error("Uso: tsx --env-file=.env evals/run-llm.ts --module=<key> [--max-cases=N] [--no-write] [--provider=<p> --model=<m>] [--method=<m>]");
    process.exit(2);
  }

  if ((provider && !model) || (!provider && model)) {
    console.error("Flags --provider e --model devem ser usadas juntas.");
    process.exit(2);
  }

  return { module, maxCases, write, provider, model, method };
}

interface Manifest {
  eval_method?: string;
  eval_methods?: Record<string, string | string[]>;
  pass_rate_threshold: number;
  pass_rate_per_outcome?: Record<string, number>;
  total_cases?: number;
}

// Retorna os outcomes que usam o método alvo (para manifests com eval_methods plural).
function outcomesForMethod(methods: Record<string, string | string[]>, target: string): string[] {
  return Object.entries(methods)
    .filter(([, m]) => (Array.isArray(m) ? m : [m]).includes(target))
    .map(([outcome]) => outcome);
}

// Resolve qual método despachar e quais outcomes filtrar.
// Quando o manifest declara múltiplos métodos por outcome, prioriza llm_as_judge
// (mais informativo). CLI pode forçar via --method=<m>.
function resolveDispatch(manifest: Manifest, methodOverride?: string): { method: string; outcomes?: string[] } {
  if (manifest.eval_method) {
    if (methodOverride && methodOverride !== manifest.eval_method) {
      return { method: "unsupported" };
    }
    return { method: manifest.eval_method };
  }
  if (manifest.eval_methods) {
    const candidates = methodOverride
      ? [methodOverride]
      : ["llm_as_judge", "assertion_shape", "exact_match_category"];
    for (const m of candidates) {
      const outcomes = outcomesForMethod(manifest.eval_methods, m);
      if (outcomes.length > 0) return { method: m, outcomes };
    }
    return { method: "unsupported" };
  }
  return { method: "unknown" };
}

function loadManifest(module: string): Manifest {
  const path = join(resolve(process.cwd(), "evals"), module, "manifest.json");
  return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const manifest = loadManifest(args.module);
  const { method, outcomes } = resolveDispatch(manifest, args.method);

  console.log(`[eval-llm] módulo=${args.module}  método=${method}  threshold=${manifest.pass_rate_threshold}`);
  if (outcomes) {
    console.log(`[eval-llm] outcomes: ${outcomes.join(", ")}`);
  }
  if (typeof args.maxCases === "number") {
    console.log(`[eval-llm] modo limitado: rodando apenas ${args.maxCases} cases`);
  }

  let summary: RunSummary;

  switch (method) {
    case "exact_match_category":
      summary = await runExactMatchCategory({
        module: args.module,
        passRateThreshold: manifest.pass_rate_threshold,
        passRatePerOutcome: manifest.pass_rate_per_outcome,
        maxCases: args.maxCases,
        modelOverride: args.provider && args.model ? { provider: args.provider, model: args.model } : undefined,
      });
      break;
    case "assertion_shape":
      summary = await runAssertionShape({
        module: args.module,
        outcomes,
        passRateThreshold: manifest.pass_rate_threshold,
        passRatePerOutcome: manifest.pass_rate_per_outcome,
        maxCases: args.maxCases,
      });
      break;
    case "llm_as_judge":
      summary = await runLlmAsJudge({
        module: args.module,
        outcomes,
        passRateThreshold: manifest.pass_rate_threshold,
        passRatePerOutcome: manifest.pass_rate_per_outcome,
        maxCases: args.maxCases,
        generatorOverride:
          args.provider && args.model ? { provider: args.provider, model: args.model } : undefined,
      });
      break;
    default:
      console.error(`[eval-llm] método "${method}" não suportado. Suportados: exact_match_category, assertion_shape, llm_as_judge`);
      process.exit(2);
  }

  console.log(``);
  console.log(`[eval-llm] ────────── resultado ──────────`);
  console.log(`  pass rate:       ${(summary.passRate * 100).toFixed(1)}%  (${summary.passed}/${summary.attemptedCases})`);
  console.log(`  threshold:       ${(summary.passRateThreshold * 100).toFixed(1)}%`);
  if (summary.passRatePerOutcome) {
    for (const [outcome, bucket] of Object.entries(summary.byOutcome)) {
      const thr = typeof bucket.threshold === "number" ? `${(bucket.threshold * 100).toFixed(0)}%` : "—";
      const status = bucket.thresholdMet === true ? "✅" : bucket.thresholdMet === false ? "❌" : "—";
      console.log(`    · ${outcome.padEnd(35)} ${(bucket.passRate * 100).toFixed(1)}% (${bucket.passed}/${bucket.total})  vs ${thr}  ${status}`);
    }
  }
  console.log(`  threshold_met:   ${summary.thresholdMet ? "SIM ✅" : "NÃO ❌"}`);
  console.log(`  custo total:     R$ ${(summary.totalCostCents / 100).toFixed(4)}`);
  console.log(`  latência total:  ${(summary.totalLatencyMs / 1000).toFixed(1)}s`);
  console.log(`  prompt hash:     ${summary.promptHash}`);

  if (args.write) {
    const reportPath = writeRunReport(summary);
    console.log(`  relatório:       ${reportPath}`);
  }

  process.exit(summary.thresholdMet ? 0 : 1);
}

main().catch((err) => {
  console.error("[eval-llm] erro fatal:", err);
  process.exit(1);
});
