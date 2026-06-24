import * as XLSX from "xlsx";
import { parseDreText, detectDreReferenceMonth } from "@/ingest/parsers/pdf-dre.js";
import { logger } from "@/observability/logger.js";
import type { ParseResult } from "@/ingest/types.js";

const MAX_XLSX_BYTES = 20 * 1024 * 1024;

const MONTH_NAMES_EXT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", mar: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08", ago: "08",
  setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
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
  const ymMatch = normalized.match(/(\d{4})[-/](\d{1,2})/);
  if (ymMatch) return `${ymMatch[1]}-${ymMatch[2]!.padStart(2, "0")}`;
  const myMatch = normalized.match(/(\d{1,2})[-/](\d{4})/);
  if (myMatch) return `${myMatch[2]}-${myMatch[1]!.padStart(2, "0")}`;
  for (const [name, month] of Object.entries(MONTH_NAMES_EXT)) {
    if (normalized.includes(name)) return month;
  }
  return null;
}

function detectYearFromFileName(fileName?: string): string | null {
  if (!fileName) return null;
  const matches = fileName.match(/(?:^|\D)(20\d{2}|19\d{2})(?=\D|$)/g) ?? [];
  const years = matches
    .map((match) => match.match(/(20\d{2}|19\d{2})/)?.[1])
    .filter((year): year is string => Boolean(year));
  return years.at(-1) ?? null;
}

function currentMonthSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function resolveSheetReferenceMonth(params: {
  monthFromContent: string | null;
  monthFromName: string | null;
  referenceMonth: string;
  fileNameYear: string | null;
}): string {
  const { monthFromContent, monthFromName, referenceMonth, fileNameYear } = params;
  if (monthFromContent) return monthFromContent;
  if (!monthFromName) return referenceMonth;
  if (/^\d{4}-\d{2}$/.test(monthFromName)) return monthFromName;
  return `${fileNameYear ?? referenceMonth.slice(0, 4)}-${monthFromName}`;
}

function isFutureMonth(referenceMonth: string, currentMonth: string): boolean {
  return /^\d{4}-\d{2}$/.test(referenceMonth) && referenceMonth > currentMonth;
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

// Marcadores de linhas/colunas que são subtotais, recap ou cabeçalhos de seção
// (não são lançamentos). O LIMPO remove do texto enviado ao LLM para evitar
// duplicação entre os blocos A-B (detalhe) e G-H (recap consolidado).
const TOTAL_LABELS = /^(total|subtotal|lucro\s*(bruto|liquido)|ebitda|fatturato|receitas?\s*$|custos?\s*$|despesas?\s*$)/i;

// Rótulos de cabeçalho de bloco (colunas A ou D quando vazias ou sozinhas) que
// não carregam valor monetário — removidos do texto final.
const SECTION_HEADERS = /^(custos|receitas|despesas|costs|revenues|expenses)$/i;

/**
 * Constrói um texto linearizado da sheet no formato "descricao, R$ valor" em
 * formato BR, a partir da matriz numérica crua. Lida com o layout 4-blocos
 * colados lado a lado (CUSTOS A-B, RECEITAS D-E, RECAP G-H):
 *  - Detecta colunas-âncora de cabeçalho de seção (CUSTOS/RECEITAS/DESPESAS)
 *    pela primeira linha, sem assumir posições fixas — tolera separadores de
 *    largura variável entre blocos
 *  - Descarta o bloco recap (sempre o último cabeçalho repetido: "RECEITAS"
 *    que aparece depois de um "RECEITAS" já visto) — ele duplica lançamentos
 *    já presentes nos blocos de detalhe
 *  - Formata números nativos no padrão BR (1.234,56), compatível com o gate
 *    BR_CURRENCY e o prompt do LLM em pdf-dre.ts
 *  - Pula linhas de total/subtotal e cabeçalhos de seção isolados
 *  - Pula linhas sem valor numérico (ex.: "R$ -" ou string vazia)
 */
export function buildSheetText(sheet: XLSX.WorkSheet): string {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (matrix.length === 0) return "";

  // Detecta pares (labelCol, valueCol) de cada bloco pela primeira linha.
  // Cabeçalhos reconhecidos: CUSTOS, RECEITAS, DESPESAS (case-insensitive).
  // O valor vive na coluna imediatamente à direita do cabeçalho.
  const firstRow = (matrix[0] as unknown[]) ?? [];
  const sections: { labelCol: number; valueCol: number; header: string }[] = [];
  for (let i = 0; i < firstRow.length; i++) {
    const cell = String(firstRow[i] ?? "").trim().toUpperCase();
    if (cell === "CUSTOS" || cell === "RECEITAS" || cell === "DESPESAS") {
      sections.push({ labelCol: i, valueCol: i + 1, header: cell });
    }
  }
  if (sections.length === 0) return "";

  // Descarta blocos recap: cabeçalhos repetidos. O layout típico tem
  // CUSTOS, RECEITAS (detalhe) e depois RECEITAS, CUSTOS (recap subtotais).
  // Mantemos a PRIMEIRA ocorrência de cada cabeçalho; repetições são recap.
  const seen = new Set<string>();
  const detailSections = sections.filter((s) => {
    if (seen.has(s.header)) return false;
    seen.add(s.header);
    return true;
  });

  const lines: string[] = [];
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length === 0) continue;

    for (const sec of detailSections) {
      const label = String(row[sec.labelCol] ?? "").trim();
      if (!label) continue;
      if (TOTAL_LABELS.test(label)) continue;
      if (SECTION_HEADERS.test(label)) continue;

      const value = toNumber(row[sec.valueCol]);
      if (value === null || value === 0) continue; // sem valor numérico (célula vazia / "R$ -" / zerado)

      const sign = value < 0 ? "-" : "";
      const formatted = formatBRCurrency(Math.abs(value));
      lines.push(`${label},${sign}${formatted}`);
    }
  }

  return lines.join("\n");
}

function toNumber(cell: unknown): number | null {
  if (typeof cell === "number" && isFinite(cell)) return cell;
  if (typeof cell === "string") {
    const s = cell.trim();
    if (!s || /^r\$\s*-?\s*$/.test(s)) return null; // "R$ -" ou vazio
    // Tenta interpretar formato BR ou EN (o xlsx pode trazer strings)
    const cleaned = s.replace(/^r\$\s*/i, "").replace(/\s/g, "");
    const asBR = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(asBR);
    if (!isNaN(n) && isFinite(n)) return n;
    const n2 = Number(cleaned.replace(/,/g, ""));
    if (!isNaN(n2) && isFinite(n2)) return n2;
  }
  return null;
}

function formatBRCurrency(value: number): string {
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withSep = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${withSep},${decPart}`;
}

export async function parseExcelDre(
  buffer: Buffer,
  referenceMonth: string,
  tenantId: string,
  options: { fileName?: string; currentMonth?: string } = {},
): Promise<ParseResult> {
  if (buffer.length === 0 || buffer.length > MAX_XLSX_BYTES) {
    return { entries: [], orphanCount: 0 };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const fileNameYear = detectYearFromFileName(options.fileName);
  const currentMonth = options.currentMonth ?? currentMonthSaoPaulo();

  const allEntries: ParseResult["entries"] = [];
  let totalOrphanCount = 0;

  for (const sheetName of workbook.SheetNames) {
    if (isSummarySheet(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetText = buildSheetText(sheet);
    if (!sheetText.trim() || !hasCurrencyValues(sheetText)) continue;

    const monthFromName = detectMonthFromSheetName(sheetName);
    const monthFromContent = detectDreReferenceMonth(sheetText);
    const fullMonth = resolveSheetReferenceMonth({
      monthFromContent,
      monthFromName,
      referenceMonth,
      fileNameYear,
    });

    if (isFutureMonth(fullMonth, currentMonth)) {
      logger.warn(
        { tenantId, sheetName, referenceMonth: fullMonth, currentMonth, fileName: options.fileName },
        "parseExcelDre: sheet ignorada por competência futura",
      );
      continue;
    }

    logger.info(
      { tenantId, sheetName, referenceMonth: fullMonth, textPreview: sheetText.slice(0, 100) },
      "parseExcelDre: processando sheet",
    );

    const result = await parseDreText(sheetText, fullMonth, tenantId);
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
