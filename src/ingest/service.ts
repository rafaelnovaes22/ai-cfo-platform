import { getPrisma } from "@/persistence/prisma.js";
import { Prisma } from "@prisma/client";
import { enqueueClassification, enqueueDreNarrative, enqueueMonthlyAnalysisGraph } from "@/queue/index.js";
import { parseExcel } from "@/ingest/parsers/excel.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parsePdfDre } from "@/ingest/parsers/pdf-dre.js";
import { parsePdfStatement } from "@/ingest/parsers/pdf-statement.js";
import { parseManual } from "@/ingest/parsers/manual.js";
import { createTrace } from "@/observability/tracing.js";
import { logger } from "@/observability/logger.js";
import type { RawLedger, IngestResult, ParseResult } from "@/ingest/types.js";

// Default — pode ser sobrescrito por tenant em productConfig.monthlyAnalysis.minEntries (C8).
const DEFAULT_MIN_INGEST_ENTRIES = 10;

export type IngestSource = "excel" | "csv" | "text" | "pdf" | "manual";

export function shouldSkipClassification(entries: RawLedger[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.confirmedCategory != null);
}

export function filterEntriesByReferenceMonth(
  entries: RawLedger[],
  referenceMonth: string,
): { entries: RawLedger[]; ignoredCount: number } {
  const filtered = entries.filter((entry) => entry.date.startsWith(`${referenceMonth}-`));
  return {
    entries: filtered,
    ignoredCount: entries.length - filtered.length,
  };
}

/**
 * Mês (YYYY-MM) com mais lançamentos. Usado como competência-container quando
 * keepAllEntries=true — o extrato pode cruzar meses, mas a MonthlyAnalysis precisa
 * de uma chave (tenantId, referenceMonth). Empate resolve pelo primeiro mês visto.
 */
export function predominantMonth(entries: RawLedger[]): string | null {
  if (entries.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [ym, c] of counts) {
    if (c > bestCount) {
      best = ym;
      bestCount = c;
    }
  }
  return best;
}

export async function ingest(params: {
  tenantId: string;
  referenceMonth: string; // "YYYY-MM"
  source: IngestSource;
  buffer?: Buffer;        // para file uploads
  text?: string;          // para clipboard
  entries?: unknown[];    // para manual
  skipAnalysis?: boolean; // true = parse+store apenas, sem enfileirar LLM (ex: plano student)
  keepAllEntries?: boolean; // true = não recorta por competência; ingere o extrato inteiro (ex: fluxo de caixa do aluno)
}): Promise<IngestResult> {
  const { tenantId, referenceMonth, source } = params;

  // C6 — trace do pipeline de ingest. Cada fase abre um span próprio.
  const trace = createTrace({
    name: "ingest",
    tenantId,
    metadata: { referenceMonth, source },
  });

  // 1. Parse conforme o formato
  const parseSpan = trace.span({ name: "parse", input: { source } });
  let parseResult: ParseResult;
  try {
    parseResult = await dispatch(params);
    parseSpan.end({
      output: { entryCount: parseResult.entries.length, orphanCount: parseResult.orphanCount },
    });
  } catch (err) {
    parseSpan.end({ level: "ERROR", output: { error: String(err) } });
    await trace.update({ metadata: { outcome: "failed", reason: "parse_error" } });
    await trace.end({ outcome: "failed" });
    logger.error({ err, source, referenceMonth, tenantId }, "Ingest parse error");
    return buildResult("failed", tenantId, referenceMonth, 0, 0);
  }

  // keepAllEntries (fluxo de caixa do aluno a partir de extrato): ingere todos os
  // lançamentos do arquivo, sem recortar por competência — o período exibido vem do
  // range real das datas. A competência-container usa o mês predominante só como chave.
  let effectiveReferenceMonth = params.keepAllEntries
    ? predominantMonth(parseResult.entries) ?? parseResult.referenceMonth ?? referenceMonth
    : parseResult.referenceMonth ?? referenceMonth;
  let { entries, ignoredCount: outOfReferenceMonthCount } = params.keepAllEntries
    ? { entries: parseResult.entries, ignoredCount: 0 }
    : filterEntriesByReferenceMonth(parseResult.entries, effectiveReferenceMonth);

  // Guarda contra perda total silenciosa: se o mês efetivo (detectado no arquivo
  // ou escolhido pelo usuário) não casa NENHUM lançamento mas há lançamentos,
  // recai no mês predominante real dos dados em vez de descartar tudo.
  if (!params.keepAllEntries && entries.length === 0 && parseResult.entries.length > 0) {
    const fallbackMonth = predominantMonth(parseResult.entries);
    if (fallbackMonth && fallbackMonth !== effectiveReferenceMonth) {
      const refiltered = filterEntriesByReferenceMonth(parseResult.entries, fallbackMonth);
      if (refiltered.entries.length > 0) {
        logger.warn(
          { tenantId, requested: effectiveReferenceMonth, fallback: fallbackMonth, recovered: refiltered.entries.length },
          "Ingest: mês efetivo descartou tudo; recaindo no mês predominante dos lançamentos",
        );
        entries = refiltered.entries;
        outOfReferenceMonthCount = refiltered.ignoredCount;
        effectiveReferenceMonth = fallbackMonth;
      }
    }
  }
  const { orphanCount } = parseResult;
  logger.info(
    {
      source,
      requestedReferenceMonth: referenceMonth,
      referenceMonth: effectiveReferenceMonth,
      tenantId,
      entryCount: entries.length,
      orphanCount,
      outOfReferenceMonthCount,
    },
    "Ingest parse concluído",
  );

  if (entries.length === 0) {
    await trace.update({
      metadata: {
        outcome: "failed",
        reason: "no_entries",
        orphanCount,
        outOfReferenceMonthCount,
      },
    });
    return buildResult("failed", tenantId, effectiveReferenceMonth, 0, orphanCount);
  }

  // 2. Upsert MonthlyAnalysis + ler threshold por tenant (C8) na mesma transação
  const db = getPrisma();
  const persistSpan = trace.span({ name: "persist", input: { entryCount: entries.length } });

  const { analysis, minEntries, orchestrator } = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { productConfig: true },
    });
    const tenantConfig = (tenant.productConfig as Record<string, unknown> | null)?.monthlyAnalysis as
      Record<string, unknown> | undefined;
    const threshold =
      (tenantConfig?.minEntries as number | undefined) ?? DEFAULT_MIN_INGEST_ENTRIES;
    const orchestrator =
      (tenantConfig?.orchestrator as string | undefined) ??
      process.env.MONTHLY_ANALYSIS_DEFAULT_ORCHESTRATOR ??
      "bullmq";
    const subscription = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });

    const existing = await tx.monthlyAnalysis.findUnique({
      where: { tenantId_referenceMonth: { tenantId, referenceMonth: effectiveReferenceMonth } },
    });

    if (existing) {
      await tx.ledgerEntry.deleteMany({ where: { analysisId: existing.id } });
      await tx.narrativeCard.deleteMany({ where: { analysisId: existing.id } });
      await tx.actionPlanItem.deleteMany({ where: { analysisId: existing.id } });
      await tx.monthlyAnalysis.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          generatedAt: null,
          deliveredAt: null,
          approvedAt: null,
          mode: subscription.mode,
          dreJson: Prisma.DbNull,
          narrativeJson: Prisma.DbNull,
          actionPlanJson: Prisma.DbNull,
          clientEditedNarrative: null,
          clientEditedActionPlan: null,
          costCents: 0,
          traceId: null,
        },
      });
      return { analysis: existing, minEntries: threshold, orchestrator };
    }

    const created = await tx.monthlyAnalysis.create({
      data: { tenantId, referenceMonth: effectiveReferenceMonth, status: "pending", mode: subscription.mode },
    });
    return { analysis: created, minEntries: threshold, orchestrator };
  });

  // 3. Bulk insert LedgerEntry
  await db.ledgerEntry.createMany({
    data: entries.map((e: RawLedger) => ({
      tenantId,
      analysisId: analysis.id,
      date: new Date(e.date),
      description: e.description,
      amountCents: e.amountCents,
      direction: e.direction,
      ...(e.confirmedCategory != null ? {
        predictedCategory:        e.confirmedCategory,
        confirmedCategory:        e.confirmedCategory,
        correctionSource:         e.correctionSource ?? "dre-import",
        classificationConfidence: e.classificationConfidence ?? 1.0,
      } : {}),
    })),
  });
  persistSpan.end({ output: { analysisId: analysis.id, minEntries } });

  // 4. Determinar outcome e enfileirar classificação se possível
  const outcome = entries.length >= minEntries ? "completed" : "partial";

  // skipAnalysis=true: apenas parse+store, sem LLM — usado por planos que não geram análise (ex: student).
  // Dados ficam disponíveis imediatamente para GET /cashflow/summary (direction+amountCents+date).
  if (outcome === "completed" && !params.skipAnalysis) {
    // Marca generating ANTES de enfileirar: se o job rodar e concluir muito rápido,
    // um update de status feito depois reverteria o resultado de volta para generating.
    await db.monthlyAnalysis.update({
      where: { id: analysis.id },
      data: { status: "generating" },
    });
    if (orchestrator === "langgraph") {
      await enqueueMonthlyAnalysisGraph({ analysisId: analysis.id, tenantId, traceId: trace.id });
      logger.info({ analysisId: analysis.id, tenantId }, "Ingest: despachando para LangGraph");
    } else if (shouldSkipClassification(entries)) {
      await enqueueDreNarrative({ analysisId: analysis.id, tenantId, traceId: trace.id });
    } else {
      await enqueueClassification({ analysisId: analysis.id, tenantId, traceId: trace.id });
    }
  }

  await trace.update({
    metadata: {
      outcome,
      analysisId: analysis.id,
      requestedReferenceMonth: referenceMonth,
      referenceMonth: effectiveReferenceMonth,
      entryCount: entries.length,
      orphanCount,
      outOfReferenceMonthCount,
      minEntries,
    },
  });
  await trace.end({ outcome, entryCount: entries.length });

  return {
    analysisId: analysis.id,
    referenceMonth: effectiveReferenceMonth,
    entryCount: entries.length,
    orphanCount,
    outcome,
  };
}

async function dispatch(params: Parameters<typeof ingest>[0]): Promise<ParseResult> {
  switch (params.source) {
    case "excel":
    case "csv":
      return parseExcel(params.buffer!);
    case "pdf": {
      // PDF pode ser extrato bancário (lista de transações, ex.: aluno no WhatsApp)
      // OU DRE consolidado do contador. Tenta o extrato primeiro (determinístico).
      const statement = await parsePdfStatement(params.buffer!);
      if (statement.entries.length > 0) return statement;
      // O parser de DRE usa LLM. No fluxo cash-flow-only (skipAnalysis = free tier do
      // aluno, zero IA), NÃO cair nele: devolve vazio e o handler orienta a enviar o
      // extrato. Sem isto, um aluno mandando DRE dispararia LLM (fura o custo R$0) e
      // veria números de competência rotulados como fluxo de caixa.
      if (params.skipAnalysis) return statement;
      return parsePdfDre(params.buffer!, params.referenceMonth, params.tenantId);
    }
    case "text":
      return parseText(params.text!);
    case "manual":
      return parseManual(params.entries!);
  }
}

function buildResult(
  outcome: IngestResult["outcome"],
  tenantId: string,
  referenceMonth: string,
  entryCount: number,
  orphanCount: number,
): IngestResult {
  return { analysisId: "", referenceMonth, entryCount, orphanCount, outcome };
}
