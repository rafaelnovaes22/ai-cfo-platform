import * as XLSX from "xlsx";
import { parseDreText, detectDreReferenceMonth } from "@/ingest/parsers/pdf-dre.js";
import { logger } from "@/observability/logger.js";
import type { ParseResult } from "@/ingest/types.js";

const MAX_XLSX_BYTES = 20 * 1024 * 1024;

const MONTH_NAMES_EXT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", mar: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", setembro: "09",
  outubro: "10", novembro: "11", dezembro: "12",
  january: "01", february: "02", march: "03", april: "04", may: "05",
  june: "06", july: "07", august: "08", september: "09", october: "10",
  november: "11", december: "12",
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05",
  giugno: "06", luglio: "07", settembre: "09", ottobre: "10",
  novembre: "11", dicembre: "12",
  gen: "01", feb: "02", apr: "04", mag: "05", giu: "06", lug: "07",
  set: "09", ott: "10", dic: "12",
};

function detectMonthFromSheetName(sheetName: string): string | null {
  const normalized = sheetName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [name, month] of Object.entries(MONTH_NAMES_EXT)) {
    if (normalized.includes(name)) return month;
  }
  const ymMatch = normalized.match(/(\d{4})[-/](\d{1,2})/);
  if (ymMatch) return `${ymMatch[1]}-${ymMatch[2]!.padStart(2, "0")}`;
  const myMatch = normalized.match(/(\d{1,2})[-/](\d{4})/);
  if (myMatch) return `${myMatch[2]}-${myMatch[1]!.padStart(2, "0")}`;
  return null;
}

function isSummarySheet(sheetName: string): boolean {
  const normalized = sheetName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /resum|summary|indicador|totals?\b/.test(normalized);
}

const BR_CURRENCY = /\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+,\d{2}/g;
function hasCurrencyValues(text: string): boolean {
  return (text.match(BR_CURRENCY) ?? []).length >= 3;
}

export async function parseExcelDre(
  buffer: Buffer,
  referenceMonth: string,
  tenantId: string,
): Promise<ParseResult> {
  if (buffer.length === 0 || buffer.length > MAX_XLSX_BYTES) {
    return { entries: [], orphanCount: 0 };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const year = referenceMonth.slice(0, 4);

  const allEntries: ParseResult["entries"] = [];
  let totalOrphanCount = 0;

  for (const sheetName of workbook.SheetNames) {
    if (isSummarySheet(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (!csvText.trim() || !hasCurrencyValues(csvText)) continue;

    const monthFromName = detectMonthFromSheetName(sheetName);
    const monthFromContent = detectDreReferenceMonth(csvText);
    const fullMonth =
      monthFromContent ??
      (monthFromName ? `${year}-${monthFromName}` : null) ??
      referenceMonth;

    logger.info(
      { tenantId, sheetName, referenceMonth: fullMonth, textPreview: csvText.slice(0, 100) },
      "parseExcelDre: processando sheet",
    );

    const result = await parseDreText(csvText, fullMonth, tenantId);
    allEntries.push(...result.entries);
    totalOrphanCount += result.orphanCount;
  }

  if (allEntries.length === 0) {
    logger.warn(
      { tenantId, referenceMonth, sheetCount: workbook.SheetNames.length },
      "parseExcelDre: nenhuma entrada extraída",
    );
    return { entries: [], orphanCount: 0 };
  }

  logger.info(
    { tenantId, referenceMonth, entryCount: allEntries.length, sheetCount: workbook.SheetNames.length },
    "parseExcelDre: extração concluída",
  );

  return { entries: allEntries, orphanCount: totalOrphanCount };
}
