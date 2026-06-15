import * as XLSX from "xlsx";
import { normalizeDate, normalizeAmountCents, resolveDirection, detectColumns, detectMonthFirst } from "@/ingest/normalize.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

// Defesa em profundidade contra o risco residual do xlsx (CVE de prototype pollution).
// Ver docs/adr/003-xlsx-mitigation.md.
const MAX_XLSX_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_XLSX_ROWS = 50_000;            // hard cap

export function parseExcel(buffer: Buffer): ParseResult {
  // Hard limits — rejeita estruturas suspeitas antes de invocar a lib.
  if (buffer.length === 0) return { entries: [], orphanCount: 0 };
  if (buffer.length > MAX_XLSX_BYTES) {
    throw new Error(`xlsx-file-too-large: ${buffer.length} bytes > ${MAX_XLSX_BYTES}`);
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    // bookSheets ignora WorkbookProps maliciosos; sheetRows trunca leitura defensiva.
    sheetRows: MAX_XLSX_ROWS,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { entries: [], orphanCount: 0 };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { entries: [], orphanCount: 0 };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) return { entries: [], orphanCount: 0 };
  if (rows.length > MAX_XLSX_ROWS) {
    // Trunca em vez de explodir — sheetRows acima já cobre, mas defesa em profundidade.
    rows.length = MAX_XLSX_ROWS;
  }

  // Alguns extratos trazem titulo/metadados antes do cabecalho real.
  const firstNonEmptyRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim().length > 0));
  if (firstNonEmptyRowIdx === -1) return { entries: [], orphanCount: 0 };

  let headerRowIdx = -1;
  let detected: ReturnType<typeof detectColumns> | null = null;

  for (let i = firstNonEmptyRowIdx; i < rows.length; i++) {
    const current = rows[i];
    if (!current) continue;
    const columns = detectColumns(current.map(String));
    const rowHasSplitAmounts = columns.creditIdx !== null && columns.debitIdx !== null;
    if (columns.dateIdx !== -1 && columns.descIdx !== -1 && (columns.amountIdx !== -1 || rowHasSplitAmounts)) {
      headerRowIdx = i;
      detected = columns;
      break;
    }
  }

  if (!detected) {
    // Tentar parsing posicional (date, desc, amount nas 3 primeiras colunas)
    return parsePositional(rows.slice(firstNonEmptyRowIdx + 1));
  }

  const { dateIdx, descIdx, amountIdx, dirIdx, creditIdx, debitIdx, impliedDirection } = detected;

  const entries: RawLedger[] = [];
  let orphanCount = 0;

  const dataRows = rows.slice(headerRowIdx + 1);
  // Orientação dia/mês detectada uma vez para o arquivo (só células-texto; datas
  // que já vêm como Date do Excel não passam por normalizeDate).
  const monthFirst = detectMonthFirst(
    dataRows.map((r) => (r[dateIdx] instanceof Date ? null : String(r[dateIdx] ?? ""))),
  );

  for (const row of dataRows) {
    const cells = row;
    const cellDate = cells[dateIdx];
    const cellDesc = cells[descIdx];

    const rawDescStr = String(cellDesc ?? "").trim();

    // Date pode vir como Date (cellDates: true) ou string.
    let date: string | null;
    if (cellDate instanceof Date) {
      date = cellDate.toISOString().slice(0, 10);
    } else {
      const rawDateStr = String(cellDate ?? "").trim();
      if (!rawDateStr && !rawDescStr) continue; // linha em branco
      date = rawDateStr ? normalizeDate(rawDateStr, monthFirst) : null;
    }

    let rawCents: number | null;
    let rawDirStr: string | null;

    if (amountIdx >= 0) {
      const cellAmount = cells[amountIdx];
      rawCents = typeof cellAmount === "number"
        ? normalizeAmountCents(cellAmount)
        : normalizeAmountCents(String(cellAmount ?? ""));
      rawDirStr = impliedDirection ?? (dirIdx !== null ? String(cells[dirIdx] ?? "") : null);
    } else {
      // Colunas separadas de crédito/débito
      const cellCredit = cells[creditIdx!];
      const cellDebit  = cells[debitIdx!];
      const creditCents = typeof cellCredit === "number"
        ? normalizeAmountCents(cellCredit)
        : normalizeAmountCents(String(cellCredit ?? ""));
      const debitCents = typeof cellDebit === "number"
        ? normalizeAmountCents(cellDebit)
        : normalizeAmountCents(String(cellDebit ?? ""));
      if (creditCents !== null && creditCents !== 0) {
        rawCents = creditCents;
        rawDirStr = "credit";
      } else {
        rawCents = debitCents;
        rawDirStr = "debit";
      }
    }

    if (!date || rawCents === null || !rawDescStr) { orphanCount++; continue; }

    const amountCents = Math.abs(rawCents);
    const resolved = resolveDirection(rawDirStr, rawCents);
    entries.push({
      date,
      description: rawDescStr,
      amountCents,
      direction: resolved.direction,
      directionSource: resolved.source,
    });
  }

  return { entries, orphanCount };
}

function parsePositional(rows: unknown[][]): ParseResult {
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  const monthFirst = detectMonthFirst(
    rows.map((r) => (r[0] instanceof Date ? null : String(r[0] ?? ""))),
  );

  for (const row of rows) {
    const cells = (row as unknown[]).map((c) => String(c ?? "").trim());
    if (cells.every((c) => !c)) continue;

    const date = normalizeDate(cells[0] ?? "", monthFirst);
    const desc = cells[1] ?? "";
    const rawCents = normalizeAmountCents(cells[2] ?? "");

    if (!date || rawCents === null || !desc) { orphanCount++; continue; }

    const resolved = resolveDirection(cells[3] ?? null, rawCents);
    entries.push({
      date,
      description: desc,
      amountCents: Math.abs(rawCents),
      direction: resolved.direction,
      directionSource: resolved.source,
    });
  }

  return { entries, orphanCount };
}
