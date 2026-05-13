import * as XLSX from "xlsx";
import { normalizeDate, normalizeAmountCents, normalizeDirection, detectColumns } from "@/ingest/normalize.js";
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

  // Primeira linha não-vazia como cabeçalho
  const headerRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim().length > 0));
  if (headerRowIdx === -1) return { entries: [], orphanCount: 0 };

  const headerRow = rows[headerRowIdx];
  if (!headerRow) return { entries: [], orphanCount: 0 };

  const headers = headerRow.map(String);
  const { dateIdx, descIdx, amountIdx, dirIdx } = detectColumns(headers);

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    // Tentar parsing posicional (date, desc, amount nas 3 primeiras colunas)
    return parsePositional(rows.slice(headerRowIdx + 1));
  }

  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const row of rows.slice(headerRowIdx + 1)) {
    const cells = row;
    const cellDate   = cells[dateIdx];
    const cellDesc   = cells[descIdx];
    const cellAmount = cells[amountIdx];
    const cellDir    = dirIdx !== null ? cells[dirIdx] : null;

    const rawDescStr = String(cellDesc ?? "").trim();
    const rawDirStr  = cellDir == null ? null : String(cellDir);

    // Date pode vir como Date (cellDates: true) ou string.
    let date: string | null;
    if (cellDate instanceof Date) {
      date = cellDate.toISOString().slice(0, 10);
    } else {
      const rawDateStr = String(cellDate ?? "").trim();
      if (!rawDateStr && !rawDescStr) continue; // linha em branco
      date = rawDateStr ? normalizeDate(rawDateStr) : null;
    }

    const rawCents = typeof cellAmount === "number"
      ? normalizeAmountCents(cellAmount)
      : normalizeAmountCents(String(cellAmount ?? ""));

    if (!date || rawCents === null || !rawDescStr) { orphanCount++; continue; }

    const amountCents = Math.abs(rawCents);
    entries.push({
      date,
      description: rawDescStr,
      amountCents,
      direction: normalizeDirection(rawDirStr, rawCents),
    });
  }

  return { entries, orphanCount };
}

function parsePositional(rows: unknown[][]): ParseResult {
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const row of rows) {
    const cells = (row as unknown[]).map((c) => String(c ?? "").trim());
    if (cells.every((c) => !c)) continue;

    const date = normalizeDate(cells[0] ?? "");
    const desc = cells[1] ?? "";
    const rawCents = normalizeAmountCents(cells[2] ?? "");

    if (!date || rawCents === null || !desc) { orphanCount++; continue; }

    entries.push({
      date,
      description: desc,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(cells[3] ?? null, rawCents),
    });
  }

  return { entries, orphanCount };
}
