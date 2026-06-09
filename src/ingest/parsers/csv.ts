import { normalizeDate, normalizeAmountCents, normalizeDirection, detectColumns } from "@/ingest/normalize.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

// Parser CSV dedicado (texto puro), deliberadamente separado do xlsx. Motivos:
//   1. Datas BR — o xlsx faz type-inference de data em CSV com semântica MM/DD
//      (americana) e ainda aplica shift de timezone: "02/06/2026" virava 6/fev.
//      Lido como string crua, normalizeDate aplica o default DD/MM correto.
//   2. Sinal — "-200,00"/"-200.00" via xlsx virava number e perdia o sinal
//      (Math.abs), transformando débito em crédito. Como string, normalizeAmountCents
//      preserva o negativo e normalizeDirection infere o sentido.
//   3. Segurança — mantém o CSV fora da lib xlsx (CVE de prototype pollution, ADR-003).

const MAX_CSV_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_CSV_ROWS = 50_000;

/**
 * Detecta o separador pela contagem somada nas primeiras linhas com conteúdo.
 * Somar (em vez de olhar só a 1a linha) é robusto a metadados sem separador antes
 * do cabeçalho. Em extratos BR com vírgula decimal ("1.234,56"), o ';' real ainda
 * vence a vírgula do decimal porque aparece em todas as colunas.
 */
function detectSeparator(lines: string[]): string {
  const candidates = [";", "\t", ","];
  let best = ",";
  let bestCount = -1;
  for (const sep of candidates) {
    let count = 0;
    for (const line of lines) count += line.split(sep).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

/** Tokeniza uma linha CSV respeitando aspas duplas (campos com separador dentro). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'; // "" → aspa literal
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCsv(buffer: Buffer): ParseResult {
  if (buffer.length === 0) return { entries: [], orphanCount: 0 };
  if (buffer.length > MAX_CSV_BYTES) {
    throw new Error(`csv-file-too-large: ${buffer.length} bytes > ${MAX_CSV_BYTES}`);
  }

  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // remove BOM do Excel BR

  const lines = text.split(/\r?\n/);
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIdx === -1) return { entries: [], orphanCount: 0 };

  const sampleLines = lines.slice(firstNonEmptyIdx).filter((l) => l.trim().length > 0).slice(0, 10);
  const sep = detectSeparator(sampleLines);

  // Tokeniza a partir da primeira linha com conteúdo; respeita o hard cap de linhas.
  const rows: string[][] = [];
  for (let i = firstNonEmptyIdx; i < lines.length && rows.length < MAX_CSV_ROWS; i++) {
    const line = lines[i] ?? "";
    rows.push(line.trim().length === 0 ? [] : splitCsvLine(line, sep));
  }

  // Detecta o header procurando a primeira linha cujas colunas batem (igual ao excel —
  // alguns extratos trazem título/metadados antes do cabeçalho real).
  let headerRowIdx = -1;
  let detected: ReturnType<typeof detectColumns> | null = null;
  for (let i = 0; i < rows.length; i++) {
    const current = rows[i];
    if (!current || current.length === 0) continue;
    const columns = detectColumns(current);
    const rowHasSplitAmounts = columns.creditIdx !== null && columns.debitIdx !== null;
    if (columns.dateIdx !== -1 && columns.descIdx !== -1 && (columns.amountIdx !== -1 || rowHasSplitAmounts)) {
      headerRowIdx = i;
      detected = columns;
      break;
    }
  }

  if (!detected) {
    // Sem header reconhecível: tenta posicional (date, desc, amount nas 3 primeiras),
    // pulando a primeira linha (provável cabeçalho não reconhecido).
    return parsePositional(rows.slice(1));
  }

  return buildEntries(rows.slice(headerRowIdx + 1), detected);
}

function buildEntries(dataRows: string[][], detected: ReturnType<typeof detectColumns>): ParseResult {
  const { dateIdx, descIdx, amountIdx, dirIdx, creditIdx, debitIdx, impliedDirection } = detected;
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const cells of dataRows) {
    if (cells.length === 0) continue; // linha em branco

    const rawDateStr = (cells[dateIdx] ?? "").trim();
    const rawDescStr = (cells[descIdx] ?? "").trim();
    if (!rawDateStr && !rawDescStr) continue; // linha sem data e sem descrição

    const date = rawDateStr ? normalizeDate(rawDateStr) : null;

    let rawCents: number | null;
    let rawDirStr: string | null;

    if (amountIdx >= 0) {
      rawCents = normalizeAmountCents(cells[amountIdx] ?? "");
      rawDirStr = impliedDirection ?? (dirIdx !== null ? (cells[dirIdx] ?? "") : null);
    } else {
      // Colunas separadas de crédito/débito.
      const creditCents = normalizeAmountCents(cells[creditIdx!] ?? "");
      const debitCents = normalizeAmountCents(cells[debitIdx!] ?? "");
      if (creditCents !== null && creditCents !== 0) {
        rawCents = creditCents;
        rawDirStr = "credit";
      } else {
        rawCents = debitCents;
        rawDirStr = "debit";
      }
    }

    if (!date || rawCents === null || !rawDescStr) {
      orphanCount++;
      continue;
    }

    entries.push({
      date,
      description: rawDescStr,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(rawDirStr, rawCents),
    });
  }

  return { entries, orphanCount };
}

function parsePositional(dataRows: string[][]): ParseResult {
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const cells of dataRows) {
    if (cells.length === 0 || cells.every((c) => !c.trim())) continue;

    const date = normalizeDate((cells[0] ?? "").trim());
    const desc = (cells[1] ?? "").trim();
    const rawCents = normalizeAmountCents(cells[2] ?? "");

    if (!date || rawCents === null || !desc) {
      orphanCount++;
      continue;
    }

    entries.push({
      date,
      description: desc,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(cells[3] ?? null, rawCents),
    });
  }

  return { entries, orphanCount };
}
