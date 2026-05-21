// Parser para texto colado (clipboard) — TSV ou CSV simples
import { normalizeDate, normalizeAmountCents, normalizeDirection, detectColumns } from "@/ingest/normalize.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

function splitRow(line: string): string[] {
  // Tenta TSV primeiro (mais comum em paste de planilha), depois CSV
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  return line.split(";").map((c) => c.trim()); // separador BR padrão
}

export function parseText(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { entries: [], orphanCount: 0 };

  // lines[0] é garantido != undefined pelo length-check acima, mas TS exige guard.
  const headerLine = lines[0] ?? "";
  const headers = splitRow(headerLine);
  const { dateIdx, descIdx, amountIdx, dirIdx, creditIdx, debitIdx } = detectColumns(headers);

  const dataLines = lines.slice(1);
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const line of dataLines) {
    const cells = splitRow(line);

    const rawDate = dateIdx >= 0 ? (cells[dateIdx] ?? "") : (cells[0] ?? "");
    const rawDesc = descIdx >= 0 ? (cells[descIdx] ?? "") : (cells[1] ?? "");

    if (!rawDate.trim() && !rawDesc.trim()) continue;

    let rawCents: number | null;
    let rawDir: string | null = dirIdx !== null ? (cells[dirIdx] ?? null) : null;

    if (amountIdx >= 0) {
      rawCents = normalizeAmountCents(cells[amountIdx] ?? "");
    } else if (creditIdx !== null && debitIdx !== null) {
      const creditVal = normalizeAmountCents(cells[creditIdx] ?? "");
      const debitVal  = normalizeAmountCents(cells[debitIdx]  ?? "");
      if (creditVal !== null && creditVal !== 0) {
        rawCents = creditVal;
        rawDir = "credit";
      } else {
        rawCents = debitVal;
        rawDir = "debit";
      }
    } else {
      rawCents = normalizeAmountCents(cells[2] ?? "");
    }

    const date = normalizeDate(rawDate);
    if (!date || rawCents === null || !rawDesc.trim()) { orphanCount++; continue; }

    entries.push({
      date,
      description: rawDesc,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(rawDir, rawCents),
    });
  }

  return { entries, orphanCount };
}
