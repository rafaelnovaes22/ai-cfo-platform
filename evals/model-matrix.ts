#!/usr/bin/env tsx
// Static model matrix generator for monthly-analysis.
// Default mode performs no LLM/API calls and only prints/writes the planned task/model matrix.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRoute } from "@/llm/router.js";
import type { AgenticLlmTask, LlmProvider, RouteConfig } from "@/llm/types.js";

const TASKS = [
  "normalization",
  "clarity-judge",
  "dre-classification",
  "anomaly-detection",
  "margin-diagnosis",
  "cashflow-risk",
  "narrative-synthesis",
  "action-planning",
  "financial-qa-review",
] as const satisfies readonly AgenticLlmTask[];

type RiskLevel = "baixo" | "médio" | "alto";
type GateStatus = "pending" | "passed" | "failed";
type OutputFormat = "markdown" | "json";

interface TaskEvaluationDefinition {
  task: AgenticLlmTask;
  responsibility: string;
  evalDataset: string;
  sampleSizeTarget: number;
  primaryMetrics: string[];
  minimumGates: string[];
  riskLevel: RiskLevel;
  promotionRule: string;
}

interface MatrixRow extends TaskEvaluationDefinition {
  primary: RouteConfig;
  fallback: RouteConfig;
  status: GateStatus;
  notes: string;
}

interface CliArgs {
  format: OutputFormat;
  output: string | undefined;
  dryRun: boolean;
}

const TASK_DEFINITIONS: Record<AgenticLlmTask, TaskEvaluationDefinition> = {
  "normalization": {
    task: "normalization",
    responsibility: "Limpar, padronizar e enriquecer lançamentos sem alterar valores financeiros.",
    evalDataset: "evals/monthly-analysis/normalization/cases.jsonl",
    sampleSizeTarget: 30,
    primaryMetrics: ["schema_success_rate", "field_preservation_rate", "latency_p95_ms", "cost_cents_per_analysis"],
    minimumGates: ["schema_success_rate >= 99%", "field_preservation_rate >= 99%", "zero alteração de valor/data sem evidência"],
    riskLevel: "médio",
    promotionRule: "Pode ir a SHADOW quando preservar campos críticos e produzir JSON válido em lote adversarial.",
  },
  "clarity-judge": {
    task: "clarity-judge",
    responsibility: "Separar descrições claras de lançamentos ambíguos que precisam de revisão humana.",
    evalDataset: "evals/monthly-analysis/clarity-judge/cases.jsonl",
    sampleSizeTarget: 30,
    primaryMetrics: ["schema_success_rate", "ambiguous_recall", "false_clear_rate", "cost_cents_per_analysis"],
    minimumGates: ["schema_success_rate >= 99%", "ambiguous_recall >= 95%", "false_clear_rate <= 5%"],
    riskLevel: "médio",
    promotionRule: "Só promove se dúvidas forem roteadas para revisão em vez de classificação forçada.",
  },
  "dre-classification": {
    task: "dre-classification",
    responsibility: "Classificar lançamentos em categorias DRE com confiança e justificativa curta.",
    evalDataset: "evals/monthly-analysis/dre-classification/cases.jsonl",
    sampleSizeTarget: 60,
    primaryMetrics: ["schema_success_rate", "accuracy_clear", "accuracy_overall", "ambiguous_to_review", "cost_cents_per_analysis"],
    minimumGates: ["schema_success_rate >= 99%", "accuracy_clear >= 90%", "accuracy_overall >= 85%", "ambiguous_to_review >= 95%"],
    riskLevel: "alto",
    promotionRule: "Fica em SHADOW até bater thresholds por outcome e por categoria material de DRE.",
  },
  "anomaly-detection": {
    task: "anomaly-detection",
    responsibility: "Detectar outliers, duplicidades e movimentos atípicos com referência aos lançamentos.",
    evalDataset: "evals/monthly-analysis/anomaly-detection/cases.jsonl",
    sampleSizeTarget: 20,
    primaryMetrics: ["schema_success_rate", "planted_issue_recall", "false_alarm_rate", "evidence_ref_rate"],
    minimumGates: ["schema_success_rate >= 98%", "planted_issue_recall >= 85%", "false_alarm_rate <= 15%", "evidence_ref_rate >= 95%"],
    riskLevel: "médio",
    promotionRule: "Alertas sem evidência devem bloquear publicação autônoma ou cair para QA humano.",
  },
  "margin-diagnosis": {
    task: "margin-diagnosis",
    responsibility: "Diagnosticar margens, variações e drivers financeiros a partir do DRE agregado.",
    evalDataset: "evals/monthly-analysis/margin-diagnosis/cases.jsonl",
    sampleSizeTarget: 20,
    primaryMetrics: ["schema_success_rate", "numeric_grounding_rate", "driver_precision", "hallucination_rate"],
    minimumGates: ["schema_success_rate >= 98%", "numeric_grounding_rate >= 95%", "hallucination_rate = 0% em afirmações críticas"],
    riskLevel: "alto",
    promotionRule: "Nenhum diagnóstico pode citar causa sem evidência numérica ou limitação explícita.",
  },
  "cashflow-risk": {
    task: "cashflow-risk",
    responsibility: "Avaliar risco de caixa e liquidez com limitações explícitas quando faltarem dados.",
    evalDataset: "evals/monthly-analysis/cashflow-risk/cases.jsonl",
    sampleSizeTarget: 20,
    primaryMetrics: ["schema_success_rate", "risk_calibration", "limitation_disclosure_rate", "false_safe_rate"],
    minimumGates: ["schema_success_rate >= 98%", "limitation_disclosure_rate >= 95%", "false_safe_rate <= 5%"],
    riskLevel: "alto",
    promotionRule: "Risco subestimado é blocker; fallback obrigatório em baixa confiança.",
  },
  "narrative-synthesis": {
    task: "narrative-synthesis",
    responsibility: "Gerar 3 cards de leitura executiva com evidência numérica e linguagem para PME.",
    evalDataset: "evals/monthly-analysis/narrative-synthesis/cases.jsonl",
    sampleSizeTarget: 30,
    primaryMetrics: ["schema_success_rate", "task_pass_rate", "evidence_ref_rate", "hallucination_rate", "human_review_rate"],
    minimumGates: ["sempre 3 cards", "evidence_ref_rate >= 95%", "task_pass_rate >= 90%", "zero afirmação sem base material"],
    riskLevel: "alto",
    promotionRule: "Cards sem evidência ou com recomendação não suportada ficam em needs_review.",
  },
  "action-planning": {
    task: "action-planning",
    responsibility: "Gerar plano de ação em 3 horizontes com doneWhen, evidências e confiança.",
    evalDataset: "evals/monthly-analysis/action-planning/cases.jsonl",
    sampleSizeTarget: 30,
    primaryMetrics: ["schema_success_rate", "task_pass_rate", "action_completeness_rate", "evidence_ref_rate", "cost_cents_per_analysis"],
    minimumGates: ["curto prazo >= 3 ações", "médio prazo >= 1 ação", "longo prazo >= 1 ação", "doneWhen/evidenceRefs/confidence em 100% das ações"],
    riskLevel: "médio",
    promotionRule: "Ação sem critério de conclusão mensurável deve falhar o case.",
  },
  "financial-qa-review": {
    task: "financial-qa-review",
    responsibility: "Revisar coerência financeira, detectar erros plantados e decidir publishable/needs_review.",
    evalDataset: "evals/monthly-analysis/financial-qa-review/cases.jsonl",
    sampleSizeTarget: 25,
    primaryMetrics: ["schema_success_rate", "planted_error_recall", "false_block_rate", "publishable_precision"],
    minimumGates: ["schema_success_rate >= 99%", "planted_error_recall >= 90%", "false_block_rate <= 10%", "publishable=false para blockers críticos"],
    riskLevel: "alto",
    promotionRule: "QA deve usar modelo/provider independente do gerador sempre que possível antes de AUTONOMOUS.",
  },
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let format: OutputFormat = "markdown";
  let output: string | undefined;
  let dryRun = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;

    if (arg === "--json") {
      format = "json";
    } else if (arg === "--markdown") {
      format = "markdown";
    } else if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value !== "markdown" && value !== "json") throw new Error("--format deve ser markdown ou json");
      format = value;
    } else if (arg === "--output") {
      output = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
    } else if (arg === "--dry-run" || arg === "--no-call") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Flag não reconhecida: ${arg}`);
    }
  }

  return { format, output, dryRun };
}

function printHelp(): void {
  console.log(`Uso: npm run eval:model-matrix -- [--format=markdown|json] [--output=<path>] [--dry-run|--no-call]\n\nGera a matriz estática de avaliação de modelos para monthly-analysis.\nNão executa chamadas LLM/API; --dry-run/--no-call é o comportamento padrão.`);
}

function providerModel(route: Pick<RouteConfig, "provider" | "model">): string {
  return `${route.provider}/${route.model}`;
}

function collectProviderMix(rows: readonly MatrixRow[]): Record<LlmProvider, number> {
  const mix: Partial<Record<LlmProvider, number>> = {};
  for (const row of rows) {
    mix[row.primary.provider] = (mix[row.primary.provider] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(mix).sort(([left], [right]) => left.localeCompare(right))) as Record<LlmProvider, number>;
}

function buildMatrix(): MatrixRow[] {
  return TASKS.map((task) => ({
    ...TASK_DEFINITIONS[task],
    primary: resolveRoute(task),
    fallback: resolveRoute(task, true),
    status: "pending",
    notes: "Aguardando execução com datasets versionados; esta matriz não faz chamadas LLM.",
  }));
}

function renderMarkdown(rows: readonly MatrixRow[], dryRun: boolean): string {
  const generatedAt = new Date().toISOString();
  const totalCases = rows.reduce((sum, row) => sum + row.sampleSizeTarget, 0);
  const providerMix = collectProviderMix(rows);

  const lines: string[] = [
    "# Monthly Analysis — model evaluation matrix",
    "",
    `Gerado em: ${generatedAt}`,
    `Modo: ${dryRun ? "dry-run/no-call (sem chamadas LLM)" : "planejamento"}`,
    `Tarefas: ${rows.length}`,
    `Amostras-alvo: ${totalCases}`,
    "",
    "## Mix de modelos primários",
    "",
  ];

  for (const [provider, count] of Object.entries(providerMix)) {
    lines.push(`- ${provider}: ${count} tarefa(s)`);
  }

  lines.push(
    "",
    "## Matriz por tarefa",
    "",
    "| Tarefa | Primário | Fallback | Risco | Dataset alvo | Amostras | Métricas primárias | Gates mínimos | Status |",
    "|---|---|---|---|---|---:|---|---|---|",
  );

  for (const row of rows) {
    lines.push(
      `| ${row.task} | ${providerModel(row.primary)} | ${providerModel(row.fallback)} | ${row.riskLevel} | ${row.evalDataset} | ${row.sampleSizeTarget} | ${row.primaryMetrics.join("<br>")} | ${row.minimumGates.join("<br>")} | ${row.status} |`,
    );
  }

  lines.push("", "## Estrutura de relatório recomendada", "");

  for (const row of rows) {
    lines.push(
      `### ${row.task}`,
      "",
      `- Responsabilidade: ${row.responsibility}`,
      `- Modelo primário: ${providerModel(row.primary)}`,
      `- Fallback: ${providerModel(row.fallback)}`,
      `- Dataset: ${row.evalDataset}`,
      `- Amostras-alvo: ${row.sampleSizeTarget}`,
      `- Métricas: ${row.primaryMetrics.join(", ")}`,
      `- Gates: ${row.minimumGates.join("; ")}`,
      `- Regra de promoção: ${row.promotionRule}`,
      `- Resultado atual: ${row.status} — ${row.notes}`,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

function renderJson(rows: readonly MatrixRow[], dryRun: boolean): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: dryRun ? "dry-run/no-call" : "planning",
      sku: "monthly-analysis",
      rows,
      providerMix: collectProviderMix(rows),
      reportSchema: {
        requiredFields: [
          "task",
          "provider",
          "model",
          "dataset_version",
          "attempted_cases",
          "schema_success_rate",
          "task_pass_rate",
          "latency_p50_ms",
          "latency_p95_ms",
          "cost_cents_per_analysis",
          "retry_rate",
          "hallucination_rate",
          "human_review_rate",
          "threshold_met",
          "decision",
        ],
      },
    },
    null,
    2,
  )}\n`;
}

function writeOutput(outputPath: string, content: string): void {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf-8");
  console.log(`[model-matrix] arquivo escrito: ${absolutePath}`);
}

export function generateModelMatrix(format: OutputFormat = "markdown", dryRun = true): string {
  const rows = buildMatrix();
  return format === "json" ? renderJson(rows, dryRun) : renderMarkdown(rows, dryRun);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const content = generateModelMatrix(args.format, args.dryRun);

  if (args.output) {
    writeOutput(args.output, content);
  } else {
    process.stdout.write(content);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error: unknown) => {
    console.error("[model-matrix] erro fatal:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
