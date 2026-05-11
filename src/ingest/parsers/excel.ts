import * as XLSX from "xlsx";
import { normalizeDate, normalizeAmountCents, normalizeDirection, detectColumns } from "@/ingest/normalize.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

export function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) return { entries: [], orphanCount: 0 };

  // Primeira linha não-vazia como cabeçalho
  const headerRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim().length > 0));
  if (headerRowIdx === -1) return { entries: [], orphanCount: 0 };

  const headers = (rows[headerRowIdx] as unknown[]).map(String);
  const { dateIdx, descIdx, amountIdx, dirIdx } = detectColumns(headers);

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    // Tentar parsing posicional (date, desc, amount nas 3 primeiras colunas)
    return parsePositional(rows.slice(headerRowIdx + 1));
  }

  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const row of rows.slice(headerRowIdx + 1)) {
    const cells = row as unknown[];
    const rawDate   = String(cells[dateIdx] ?? "").trim();
    const rawDesc   = String(cells[descIdx] ?? "").trim();
    const rawAmount = cells[amountIdx];
    const rawDir    = dirIdx !== null ? String(cells[dirIdx] ?? "") : null;

    if (!rawDate && !rawDesc) continue; // linha em branco

    const date = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : normalizeDate(rawDate);

    const rawCents = typeof rawAmount === "number"
      ? normalizeAmountCents(rawAmount)
      : normalizeAmountCents(String(rawAmount ?? ""));

    if (!date || rawCents === null || !rawDesc) { orphanCount++; continue; }

    const amountCents = Math.abs(rawCents);
    entries.push({
      date,
      description: rawDesc,
      amountCents,
      direction: normalizeDirection(rawDir, rawCents),
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
