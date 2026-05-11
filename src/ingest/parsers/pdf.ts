// Parser de PDF contábil — extrai texto e aplica heurísticas para detectar linhas de lançamento
// pdf-parse é CJS; import com createRequire para compatibilidade ESM
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import { normalizeDate, normalizeAmountCents, normalizeDirection } from "@/ingest/normalize.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

// Regex para detectar linha com data + valor (padrão BR)
const LINE_WITH_DATE   = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
const AMOUNT_IN_LINE   = /([\d.,]+(?:[,.]\d{2})?)(?:\s*(C|D|CR|DB|crédito|débito|entrada|saída))?/i;

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const lines = data.text.split(/\r?\n/).filter((l) => l.trim().length > 3);

  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const line of lines) {
    const dateMatch = line.match(LINE_WITH_DATE);
    if (!dateMatch) continue; // linha sem data → provavelmente cabeçalho ou rodapé

    const date = normalizeDate(dateMatch[1]);
    if (!date) continue;

    // Remove a data da linha para isolar descrição e valor
    const rest = line.replace(dateMatch[0], "").trim();

    const amountMatch = rest.match(AMOUNT_IN_LINE);
    if (!amountMatch) { orphanCount++; continue; }

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
