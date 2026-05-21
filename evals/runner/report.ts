import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RunSummary } from "./types.js";

const EVALS_ROOT = resolve(process.cwd(), "evals");

export function writeRunReport(summary: RunSummary): string {
  const runsDir = join(EVALS_ROOT, summary.module, "runs");
  mkdirSync(runsDir, { recursive: true });
  const dateStr = summary.finishedAt.slice(0, 10);
  const modelSlug = summary.model.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `${dateStr}-eval-${summary.promptHash}-${modelSlug}.md`;
  const filePath = join(runsDir, filename);
  writeFileSync(filePath, renderMarkdown(summary), "utf-8");
  return filePath;
}

function renderMarkdown(s: RunSummary): string {
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`module: ${s.module}`);
  lines.push(`eval_method: ${s.evalMethod}`);
  lines.push(`prompt_hash: ${s.promptHash}`);
  lines.push(`provider: ${s.provider}`);
  lines.push(`model: ${s.model}`);
  lines.push(`started_at: ${s.startedAt}`);
  lines.push(`finished_at: ${s.finishedAt}`);
  lines.push(`total_cases: ${s.totalCases}`);
  lines.push(`attempted_cases: ${s.attemptedCases}`);
  lines.push(`passed: ${s.passed}`);
  lines.push(`failed: ${s.failed}`);
  lines.push(`pass_rate: ${pct(s.passRate)}`);
  lines.push(`pass_rate_threshold: ${pct(s.passRateThreshold)}`);
  lines.push(`threshold_met: ${s.thresholdMet}`);
  lines.push(`total_cost_cents: ${s.totalCostCents}`);
  lines.push(`total_cost_brl: ${(s.totalCostCents / 100).toFixed(4)}`);
  lines.push(`total_latency_ms: ${s.totalLatencyMs}`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# Eval Run — ${s.module} — ${s.finishedAt.slice(0, 10)}`);
  lines.push(``);
  lines.push(`**Veredito**: ${s.thresholdMet ? "✅ APROVADO" : "❌ REPROVADO"} — pass rate ${pct(s.passRate)} vs threshold ${pct(s.passRateThreshold)}`);
  lines.push(``);
  lines.push(`## Resumo`);
  lines.push(``);
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---|---|`);
  lines.push(`| Provider / modelo | ${s.provider} / \`${s.model}\` |`);
  lines.push(`| Prompt hash | \`${s.promptHash}\` |`);
  lines.push(`| Cases tentados | ${s.attemptedCases} / ${s.totalCases} |`);
  lines.push(`| Passaram | ${s.passed} |`);
  lines.push(`| Falharam | ${s.failed} |`);
  lines.push(`| Custo total | R$ ${(s.totalCostCents / 100).toFixed(4)} |`);
  lines.push(`| Latência total | ${(s.totalLatencyMs / 1000).toFixed(1)}s |`);
  lines.push(`| Latência média | ${s.attemptedCases ? Math.round(s.totalLatencyMs / s.attemptedCases) : 0}ms |`);
  lines.push(``);

  lines.push(`## Pass rate por outcome`);
  lines.push(``);
  const hasPerOutcomeThreshold = Object.values(s.byOutcome).some((b) => typeof b.threshold === "number");
  if (hasPerOutcomeThreshold) {
    lines.push(`| Outcome | Passados | Total | Pass rate | Threshold | Status |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const [k, b] of Object.entries(s.byOutcome)) {
      const thr = typeof b.threshold === "number" ? pct(b.threshold) : "—";
      const status = b.thresholdMet === true ? "✅" : b.thresholdMet === false ? "❌" : "—";
      lines.push(`| ${k} | ${b.passed} | ${b.total} | ${pct(b.passRate)} | ${thr} | ${status} |`);
    }
  } else {
    lines.push(`| Outcome | Passados | Total | Pass rate |`);
    lines.push(`|---|---|---|---|`);
    for (const [k, b] of Object.entries(s.byOutcome)) {
      lines.push(`| ${k} | ${b.passed} | ${b.total} | ${pct(b.passRate)} |`);
    }
  }
  lines.push(``);

  lines.push(`## Pass rate por source_mode`);
  lines.push(``);
  lines.push(`| Source | Passados | Total | Pass rate |`);
  lines.push(`|---|---|---|---|`);
  for (const [k, b] of Object.entries(s.bySourceMode)) {
    lines.push(`| ${k} | ${b.passed} | ${b.total} | ${pct(b.passRate)} |`);
  }
  lines.push(``);

  const failures = s.cases.filter((c) => !c.passed);
  if (failures.length > 0) {
    lines.push(`## Falhas (${failures.length})`);
    lines.push(``);
    lines.push(`| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const f of failures) {
      lines.push(
        `| ${f.caseId} | ${f.outcome} | ${f.sourceMode} | ${f.predicted ?? "—"} | ${f.expected ?? "—"} | ${f.confidence?.toFixed(2) ?? "—"} | ${f.reason} |`,
      );
    }
    lines.push(``);
  }

  lines.push(`## Detalhamento por case (todos)`);
  lines.push(``);
  lines.push(`<details><summary>Expandir tabela completa</summary>`);
  lines.push(``);
  lines.push(`| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const c of s.cases) {
    lines.push(
      `| ${c.caseId} | ${c.outcome} | ${c.sourceMode} | ${c.passed ? "✅" : "❌"} | ${c.predicted ?? "—"} | ${c.confidence?.toFixed(2) ?? "—"} | ${c.latencyMs} | ${c.costCents} |`,
    );
  }
  lines.push(``);
  lines.push(`</details>`);
  lines.push(``);

  return lines.join("\n");
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
