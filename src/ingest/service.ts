import { getPrisma } from "@/persistence/prisma.js";
import { Prisma } from "@prisma/client";
import { enqueueClassification, enqueueDreNarrative, enqueueMonthlyAnalysisGraph } from "@/queue/index.js";
import { parseExcel } from "@/ingest/parsers/excel.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parsePdfDre } from "@/ingest/parsers/pdf-dre.js";
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

export async function ingest(params: {
  tenantId: string;
  referenceMonth: string; // "YYYY-MM"
  source: IngestSource;
  buffer?: Buffer;        // para file uploads
  text?: string;          // para clipboard
  entries?: unknown[];    // para manual
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

  const effectiveReferenceMonth = parseResult.referenceMonth ?? referenceMonth;
  const { entries, ignoredCount: outOfReferenceMonthCount } = filterEntriesByReferenceMonth(
    parseResult.entries,
    effectiveReferenceMonth,
  );
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
      return { analysis: existing, minEntries: threshold };
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

  if (outcome === "completed") {
    if (orchestrator === "langgraph") {
      await enqueueMonthlyAnalysisGraph({ analysisId: analysis.id, tenantId, traceId: trace.id });
      logger.info({ analysisId: analysis.id, tenantId }, "Ingest: despachando para LangGraph");
    } else if (shouldSkipClassification(entries)) {
      await enqueueDreNarrative({ analysisId: analysis.id, tenantId, traceId: trace.id });
    } else {
      await enqueueClassification({ analysisId: analysis.id, tenantId, traceId: trace.id });
    }
    await db.monthlyAnalysis.update({
      where: { id: analysis.id },
      data: { status: "generating" },
    });
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
    case "pdf":
      // No Aicfo, upload PDF representa DRE consolidado do contador.
      // Extratos/ledgers devem entrar como Excel, CSV ou texto colado.
      return parsePdfDre(params.buffer!, params.referenceMonth, params.tenantId);
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
