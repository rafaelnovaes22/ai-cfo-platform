#!/usr/bin/env tsx
/**
 * SHADOW runner — invoca o grafo agentic do monthly-analysis contra um
 * analysisId real já processado pelo pipeline BullMQ legacy e gera relatório
 * de diff entre as duas saídas.
 *
 * Uso:
 *   npm run shadow:graph -- --analysisId=<uuid>
 *   npm run shadow:graph -- --analysisId=<uuid> --tenantId=<uuid>
 *
 * Garantias:
 * - NÃO escreve nada nos modelos Prisma de produção
 * - Gera arquivos em evals/monthly-analysis/shadow-runs/{YYYY-MM-DD}-{analysisId}.{json|md}
 * - Chama LLMs reais (OpenAI/Google) — custo absorvido pelo .env do operador
 *
 * Atenção: requer .env com chaves de API válidas. Usar `npm run shadow:graph`
 * (script aciona --env-file=.env automaticamente).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMonthlyAnalysisGraph } from "@/monthly-analysis/graph/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

interface CliArgs {
  analysisId: string;
  tenantId?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "analysisId" && value) args.analysisId = value;
    if (key === "tenantId" && value) args.tenantId = value;
  }
  if (!args.analysisId) {
    throw new Error("--analysisId=<uuid> é obrigatório. Ex: npm run shadow:graph -- --analysisId=abc-123");
  }
  return args as CliArgs;
}

interface LegacyResults {
  classifications: Array<{ entryId: string; category: string | null }>;
  narrativeCards: Array<{ type: string; title: string; body: string }>;
  actionItems: Array<{ horizon: string; title: string; doneWhen: string | null }>;
}

async function loadLegacyResults(analysisId: string, tenantId: string): Promise<LegacyResults> {
  const prisma = getPrisma();
  const [entries, cards, items] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { analysisId, tenantId },
      select: { id: true, confirmedCategory: true, predictedCategory: true },
    }),
    prisma.narrativeCard.findMany({
      where: { analysisId },
      select: { cardType: true, title: true, body: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionPlanItem.findMany({
      where: { analysisId },
      select: { horizon: true, title: true, doneWhen: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    classifications: entries.map((e) => ({
      entryId: e.id,
      category: e.confirmedCategory ?? e.predictedCategory ?? null,
    })),
    narrativeCards: cards.map((c) => ({ type: c.cardType, title: c.title, body: c.body })),
    actionItems: items.map((i) => ({ horizon: i.horizon, title: i.title, doneWhen: i.doneWhen })),
  };
}

interface AgenticResults {
  classifications: Array<{ entryId: string; category: string }>;
  narrativeCards: Array<{ type: string; title: string; body: string }>;
  actions: Array<{ horizon: string; title: string; doneWhen: string }>;
}

function extractAgentic(state: Awaited<ReturnType<ReturnType<typeof buildMonthlyAnalysisGraph>["invoke"]>>): AgenticResults {
  return {
    classifications: (state.classifiedEntries ?? []).map((c) => ({
      entryId: c.entryId,
      category: c.category,
    })),
    narrativeCards: (state.narrativeCards ?? []).map((c) => ({
      type: c.type,
      title: c.title,
      body: c.body,
    })),
    actions: (state.actionPlan?.actions ?? []).map((a) => ({
      horizon: a.horizon,
      title: a.title,
      doneWhen: a.doneWhen,
    })),
  };
}

interface DiffReport {
  classification: {
    totalEntries: number;
    matched: number;
    matchPct: number;
    diverged: Array<{ entryId: string; legacy: string | null; agentic: string }>;
  };
  narrative: {
    legacyCount: number;
    agenticCount: number;
    typeOverlap: string[];
    typeOnlyLegacy: string[];
    typeOnlyAgentic: string[];
  };
  plan: {
    legacyByHorizon: Record<string, number>;
    agenticByHorizon: Record<string, number>;
    coverageMatch: boolean;
  };
}

function buildDiff(legacy: LegacyResults, agentic: AgenticResults): DiffReport {
  // Classification
  const agenticById = new Map(agentic.classifications.map((c) => [c.entryId, c.category]));
  let matched = 0;
  const diverged: Array<{ entryId: string; legacy: string | null; agentic: string }> = [];
  for (const legacyClass of legacy.classifications) {
    const agenticCategory = agenticById.get(legacyClass.entryId);
    if (!agenticCategory) continue;
    if (agenticCategory === legacyClass.category) {
      matched++;
    } else {
      diverged.push({
        entryId: legacyClass.entryId,
        legacy: legacyClass.category,
        agentic: agenticCategory,
      });
    }
  }
  const totalEntries = legacy.classifications.length;
  const matchPct = totalEntries > 0 ? (matched / totalEntries) * 100 : 0;

  // Narrative
  const legacyTypes = new Set(legacy.narrativeCards.map((c) => c.type));
  const agenticTypes = new Set(agentic.narrativeCards.map((c) => c.type));
  const typeOverlap = [...legacyTypes].filter((t) => agenticTypes.has(t));
  const typeOnlyLegacy = [...legacyTypes].filter((t) => !agenticTypes.has(t));
  const typeOnlyAgentic = [...agenticTypes].filter((t) => !legacyTypes.has(t));

  // Plan
  const byHorizon = (arr: { horizon: string }[]): Record<string, number> =>
    arr.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.horizon]: (acc[a.horizon] ?? 0) + 1 }), {});
  const legacyByHorizon = byHorizon(legacy.actionItems);
  const agenticByHorizon = byHorizon(agentic.actions);
  const coverageMatch =
    (legacyByHorizon.short ?? 0) >= 3 === (agenticByHorizon.short ?? 0) >= 3 &&
    (legacyByHorizon.medium ?? 0) >= 1 === (agenticByHorizon.medium ?? 0) >= 1 &&
    (legacyByHorizon.long ?? 0) >= 1 === (agenticByHorizon.long ?? 0) >= 1;

  return {
    classification: { totalEntries, matched, matchPct, diverged },
    narrative: { legacyCount: legacy.narrativeCards.length, agenticCount: agentic.narrativeCards.length, typeOverlap, typeOnlyLegacy, typeOnlyAgentic },
    plan: { legacyByHorizon, agenticByHorizon, coverageMatch },
  };
}

function renderMarkdown(analysisId: string, diff: DiffReport, agentic: AgenticResults): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# SHADOW report — monthly-analysis`);
  lines.push(``);
  lines.push(`**analysisId**: \`${analysisId}\`  `);
  lines.push(`**date**: ${date}  `);
  lines.push(`**generated_by**: scripts/run-monthly-analysis-graph-shadow.ts`);
  lines.push(``);
  lines.push(`> SHADOW comparison — pipeline LangGraph agentic × pipeline BullMQ legacy. Não escreve em produção.`);
  lines.push(``);

  // Classification
  lines.push(`## 1. Classification`);
  lines.push(``);
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---|---|`);
  lines.push(`| Total de lançamentos | ${diff.classification.totalEntries} |`);
  lines.push(`| Categorias coincidentes | ${diff.classification.matched} |`);
  lines.push(`| **Match rate** | **${diff.classification.matchPct.toFixed(2)}%** |`);
  lines.push(`| Divergências | ${diff.classification.diverged.length} |`);
  lines.push(``);
  if (diff.classification.diverged.length > 0) {
    lines.push(`### Top 10 divergências`);
    lines.push(``);
    lines.push(`| entryId | legacy | agentic |`);
    lines.push(`|---|---|---|`);
    for (const d of diff.classification.diverged.slice(0, 10)) {
      lines.push(`| \`${d.entryId}\` | ${d.legacy ?? "_null_"} | ${d.agentic} |`);
    }
    lines.push(``);
  }

  // Narrative
  lines.push(`## 2. Narrative`);
  lines.push(``);
  lines.push(`| Métrica | Legacy | Agentic |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Cards | ${diff.narrative.legacyCount} | ${diff.narrative.agenticCount} |`);
  lines.push(`| Tipos em comum | \`${diff.narrative.typeOverlap.join(", ") || "—"}\` | — |`);
  lines.push(`| Só no legacy | \`${diff.narrative.typeOnlyLegacy.join(", ") || "—"}\` | — |`);
  lines.push(`| Só no agentic | — | \`${diff.narrative.typeOnlyAgentic.join(", ") || "—"}\` |`);
  lines.push(``);
  if (agentic.narrativeCards.length > 0) {
    lines.push(`### Cards agentic (texto integral)`);
    lines.push(``);
    for (const c of agentic.narrativeCards) {
      lines.push(`#### [${c.type}] ${c.title}`);
      lines.push(``);
      lines.push(c.body);
      lines.push(``);
    }
  }

  // Plan
  lines.push(`## 3. Plan`);
  lines.push(``);
  lines.push(`| Horizon | Legacy | Agentic |`);
  lines.push(`|---|---|---|`);
  for (const h of ["short", "medium", "long"]) {
    lines.push(`| ${h} | ${diff.plan.legacyByHorizon[h] ?? 0} | ${diff.plan.agenticByHorizon[h] ?? 0} |`);
  }
  lines.push(``);
  lines.push(`**Coverage match (≥3 short, ≥1 medium, ≥1 long)**: ${diff.plan.coverageMatch ? "✅ sim" : "❌ não"}`);
  lines.push(``);
  if (agentic.actions.length > 0) {
    lines.push(`### Ações agentic`);
    lines.push(``);
    lines.push(`| Horizon | Title | doneWhen |`);
    lines.push(`|---|---|---|`);
    for (const a of agentic.actions) {
      lines.push(`| ${a.horizon} | ${a.title} | ${a.doneWhen} |`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const date = new Date().toISOString().slice(0, 10);

  logger.info({ analysisId: args.analysisId }, "SHADOW: iniciando comparação legacy × agentic");

  // Descobre tenantId se não fornecido
  const prisma = getPrisma();
  let tenantId = args.tenantId;
  if (!tenantId) {
    const analysis = await prisma.monthlyAnalysis.findUnique({
      where: { id: args.analysisId },
      select: { tenantId: true },
    });
    if (!analysis) {
      throw new Error(`Analysis '${args.analysisId}' não encontrada no banco.`);
    }
    tenantId = analysis.tenantId;
    logger.info({ tenantId }, "SHADOW: tenantId descoberto via DB");
  }

  // Invoca grafo agentic
  logger.info("SHADOW: invocando grafo LangGraph (chamadas LLM reais)");
  const graph = buildMonthlyAnalysisGraph();
  const state = await graph.invoke({
    analysisId: args.analysisId,
    tenantId,
    costs: [],
    traces: [],
    errors: [],
  });

  // Lê resultados legacy
  logger.info("SHADOW: lendo resultados do pipeline legacy");
  const legacy = await loadLegacyResults(args.analysisId, tenantId);
  const agentic = extractAgentic(state);

  // Diff + persistência
  const diff = buildDiff(legacy, agentic);

  const outDir = resolve("evals/monthly-analysis/shadow-runs");
  mkdirSync(outDir, { recursive: true });
  const baseName = `${date}-${args.analysisId}`;

  const stateFile = resolve(outDir, `${baseName}.json`);
  writeFileSync(stateFile, JSON.stringify({ state, legacy, agentic, diff }, null, 2), "utf-8");

  const reportFile = resolve(outDir, `${baseName}-report.md`);
  writeFileSync(reportFile, renderMarkdown(args.analysisId, diff, agentic), "utf-8");

  logger.info(
    {
      analysisId: args.analysisId,
      stateFile,
      reportFile,
      classificationMatchPct: diff.classification.matchPct.toFixed(2),
      coverageMatch: diff.plan.coverageMatch,
    },
    "SHADOW: comparação concluída",
  );

  // Resumo stdout (separa do log estruturado)
  console.log(`\n=== SHADOW summary ===`);
  console.log(`analysisId: ${args.analysisId}`);
  console.log(`classification match: ${diff.classification.matchPct.toFixed(2)}% (${diff.classification.matched}/${diff.classification.totalEntries})`);
  console.log(`narrative: legacy=${diff.narrative.legacyCount} cards, agentic=${diff.narrative.agenticCount} cards, overlap=${diff.narrative.typeOverlap.join(",") || "—"}`);
  console.log(`plan coverage match: ${diff.plan.coverageMatch ? "yes" : "no"}`);
  console.log(`\nFiles:\n  ${stateFile}\n  ${reportFile}\n`);
}

main().catch((err) => {
  logger.error({ err }, "SHADOW: erro fatal");
  process.exit(1);
});
