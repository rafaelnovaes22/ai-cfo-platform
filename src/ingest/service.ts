import { getPrisma } from "@/persistence/prisma.js";
import { enqueueClassification } from "@/queue/index.js";
import { parseExcel } from "@/ingest/parsers/excel.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parsePdf } from "@/ingest/parsers/pdf.js";
import { parseManual } from "@/ingest/parsers/manual.js";
import type { RawLedger, IngestResult, ParseResult } from "@/ingest/types.js";

const MIN_ENTRIES = 50;

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

  // 1. Parse conforme o formato
  let parseResult: ParseResult;
  try {
    parseResult = await dispatch(params);
  } catch {
    return buildResult("failed", tenantId, referenceMonth, 0, 0);
  }

  const { entries, orphanCount } = parseResult;
  if (entries.length === 0) return buildResult("failed", tenantId, referenceMonth, 0, orphanCount);

  // 2. Upsert MonthlyAnalysis (re-import apaga lançamentos anteriores do mesmo mês)
  const db = getPrisma();

  const analysis = await db.$transaction(async (tx) => {
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
      return existing;
    }

    const subscription = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
    return tx.monthlyAnalysis.create({
      data: { tenantId, referenceMonth, status: "pending", mode: subscription.mode },
    });
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

  // 4. Determinar outcome e enfileirar classificação se possível
  const outcome = entries.length >= MIN_ENTRIES ? "completed" : "partial";

  if (outcome === "completed") {
    await enqueueClassification({ analysisId: analysis.id, tenantId });
    await db.monthlyAnalysis.update({
      where: { id: analysis.id },
      data: { status: "generating" },
    });
  }

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
