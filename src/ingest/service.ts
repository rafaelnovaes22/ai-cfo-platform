import { getPrisma } from "@/persistence/prisma.js";
import { enqueueClassification } from "@/queue/index.js";
import { parseExcel } from "@/ingest/parsers/excel.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parsePdf } from "@/ingest/parsers/pdf.js";
import { parseManual } from "@/ingest/parsers/manual.js";
import { createTrace } from "@/observability/langfuse.js";
import type { RawLedger, IngestResult, ParseResult } from "@/ingest/types.js";

// Default — pode ser sobrescrito por tenant em productConfig.monthlyAnalysis.minEntries (C8).
const DEFAULT_MIN_INGEST_ENTRIES = 50;

export type IngestSource = "excel" | "csv" | "text" | "pdf" | "manual";

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
    return buildResult("failed", tenantId, referenceMonth, 0, 0);
  }

  const { entries, orphanCount } = parseResult;
  if (entries.length === 0) {
    await trace.update({ metadata: { outcome: "failed", reason: "no_entries", orphanCount } });
    return buildResult("failed", tenantId, referenceMonth, 0, orphanCount);
  }

  // 2. Upsert MonthlyAnalysis + ler threshold por tenant (C8) na mesma transação
  const db = getPrisma();
  const persistSpan = trace.span({ name: "persist", input: { entryCount: entries.length } });

  const { analysis, minEntries } = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { productConfig: true },
    });
    const tenantConfig = (tenant.productConfig as Record<string, unknown> | null)?.monthlyAnalysis as
      Record<string, unknown> | undefined;
    const threshold =
      (tenantConfig?.minEntries as number | undefined) ?? DEFAULT_MIN_INGEST_ENTRIES;

    const existing = await tx.monthlyAnalysis.findUnique({
      where: { tenantId_referenceMonth: { tenantId, referenceMonth } },
    });

    if (existing) {
      await tx.ledgerEntry.deleteMany({ where: { analysisId: existing.id } });
      await tx.narrativeCard.deleteMany({ where: { analysisId: existing.id } });
      await tx.actionPlanItem.deleteMany({ where: { analysisId: existing.id } });
      await tx.monthlyAnalysis.update({
        where: { id: existing.id },
        data: { status: "pending", generatedAt: null, deliveredAt: null, approvedAt: null },
      });
      return { analysis: existing, minEntries: threshold };
    }

    const subscription = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
    const created = await tx.monthlyAnalysis.create({
      data: { tenantId, referenceMonth, status: "pending", mode: subscription.mode },
    });
    return { analysis: created, minEntries: threshold };
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
    })),
  });
  persistSpan.end({ output: { analysisId: analysis.id, minEntries } });

  // 4. Determinar outcome e enfileirar classificação se possível
  const outcome = entries.length >= minEntries ? "completed" : "partial";

  if (outcome === "completed") {
    await enqueueClassification({ analysisId: analysis.id, tenantId, traceId: trace.id });
    await db.monthlyAnalysis.update({
      where: { id: analysis.id },
      data: { status: "generating" },
    });
  }

  await trace.update({
    metadata: { outcome, analysisId: analysis.id, entryCount: entries.length, orphanCount, minEntries },
  });

  return {
    analysisId: analysis.id,
    referenceMonth,
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
      return parsePdf(params.buffer!);
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
