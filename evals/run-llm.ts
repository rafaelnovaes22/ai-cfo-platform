// Eval LLM runner — executa cases contra prompts vigentes via LLM real.
// Uso: tsx --env-file=.env evals/run-llm.ts --module=<key> [--max-cases=N] [--no-write]
//
// Dispatch por manifest.eval_method. Fase 1: exact_match_category (classification).

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runExactMatchCategory } from "./runner/methods/exact-match-category.js";
import { writeRunReport } from "./runner/report.js";
import type { RunSummary } from "./runner/types.js";

import type { LlmProvider } from "@/llm/types.js";

interface CliArgs {
  module: string;
  maxCases: number | undefined;
  write: boolean;
  provider: LlmProvider | undefined;
  model: string | undefined;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let module: string | undefined;
  let maxCases: number | undefined;
  let write = true;
  let provider: LlmProvider | undefined;
  let model: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--module=")) module = arg.slice("--module=".length);
    else if (arg === "--module") module = args[args.indexOf(arg) + 1];
    else if (arg.startsWith("--max-cases=")) maxCases = Number(arg.slice("--max-cases=".length));
    else if (arg === "--no-write") write = false;
    else if (arg.startsWith("--provider=")) provider = arg.slice("--provider=".length) as LlmProvider;
    else if (arg.startsWith("--model=")) model = arg.slice("--model=".length);
  }

  if (!module) {
    console.error("Uso: tsx --env-file=.env evals/run-llm.ts --module=<key> [--max-cases=N] [--no-write] [--provider=<p> --model=<m>]");
    process.exit(2);
  }

  if ((provider && !model) || (!provider && model)) {
    console.error("Flags --provider e --model devem ser usadas juntas.");
    process.exit(2);
  }

  return { module, maxCases, write, provider, model };
}

interface Manifest {
  eval_method?: string;
  eval_methods?: Record<string, string | string[]>;
  pass_rate_threshold: number;
  pass_rate_per_outcome?: Record<string, number>;
  total_cases?: number;
}

function loadManifest(module: string): Manifest {
  const path = join(resolve(process.cwd(), "evals"), module, "manifest.json");
  return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const manifest = loadManifest(args.module);
  const method = manifest.eval_method;

  console.log(`[eval-llm] módulo=${args.module}  método=${method}  threshold=${manifest.pass_rate_threshold}`);
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
    default:
      console.error(`[eval-llm] eval_method "${method}" não suportado nesta fase. Suportados: exact_match_category`);
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
