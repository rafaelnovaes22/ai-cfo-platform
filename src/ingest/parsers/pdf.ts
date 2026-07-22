// Parser de PDF contábil — extrai texto e aplica heurísticas para detectar linhas de lançamento
import { normalizeDate, normalizeAmountCents, normalizeDirection } from "@/ingest/normalize.js";
import { extractPdfText } from "@/ingest/parsers/pdf-text.js";
import { logger } from "@/observability/logger.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

// Regex para detectar linha de lançamento. A data precisa abrir a linha;
// DRE consolidado tem datas em cabeçalhos ("Período de competência") e deve cair no parser DRE.
const LINE_WITH_DATE   = /^\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
const AMOUNT_IN_LINE   = /([\d.,]+(?:[,.]\d{2})?)(?:\s*(C|D|CR|DB|crédito|débito|entrada|saída))?/i;

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const text = await extractPdfText(buffer);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 3);
  logger.info({ totalLines: lines.length, textPreview: text.slice(0, 300) }, "parsePdf: texto extraído do PDF");

  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const line of lines) {
    const dateMatch = line.match(LINE_WITH_DATE);
    if (!dateMatch || !dateMatch[1]) continue; // linha sem data → provavelmente cabeçalho ou rodapé

    const date = normalizeDate(dateMatch[1]);
    if (!date) continue;

    // Remove a data da linha para isolar descrição e valor
    const rest = line.replace(dateMatch[0], "").trim();

    const amountMatch = rest.match(AMOUNT_IN_LINE);
    if (!amountMatch || !amountMatch[1]) { orphanCount++; continue; }

    const rawCents = normalizeAmountCents(amountMatch[1]);
    if (rawCents === null) { orphanCount++; continue; }

    // Descrição = tudo antes do valor
    const description = rest.slice(0, rest.indexOf(amountMatch[0])).trim().replace(/\s+/g, " ");
    if (!description) { orphanCount++; continue; }

    entries.push({
      date,
      description,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(amountMatch[2] ?? null, rawCents),
    });
  }

  return { entries, orphanCount };
}
