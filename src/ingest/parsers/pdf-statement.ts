// Parser de EXTRATO BANCÁRIO em PDF (lista de transações).
// Diferente do parsePdfDre (DRE consolidado do contador). Trata layouts tipo
// Santander/Itaú/etc.: DATA  DESCRIÇÃO  DOCTO  [SITUAÇÃO]  CRÉDITO/DÉBITO  SALDO.
//
// Heurística: a linha começa com uma data; o PENÚLTIMO valor monetário BR é o
// lançamento (o último é o saldo corrente) e a direção vem do sinal (- = débito).
// Docto/CNPJ (dígitos sem decimal) são ignorados pelo regex de valor.
import { normalizeDate, normalizeAmountCents, normalizeDirection } from "@/ingest/normalize.js";
import { extractPdfText } from "@/ingest/parsers/pdf-text.js";
import { logger } from "@/observability/logger.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

const LINE_DATE = /^\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/;
// Valor monetário BR: 1.234,56 / 70,00 / 0,21, com sinal opcional ('-' ou '−' unicode).
const BR_AMOUNT = /[-−]?\d{1,3}(?:\.\d{3})*,\d{2}/g;

export function parseStatementText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const entries: RawLedger[] = [];
  let orphanCount = 0;

  for (const line of lines) {
    const dateMatch = line.match(LINE_DATE);
    if (!dateMatch || !dateMatch[1]) continue;
    const date = normalizeDate(dateMatch[1]);
    if (!date) continue;

    const rest = line.slice(dateMatch[0].length);
    const amounts = rest.match(BR_AMOUNT);
    // Transação tem 2 valores: [lançamento, saldo]. Linhas com 0 ou 1 valor são
    // cabeçalho ou "Saldo anterior/inicial" — ignoradas. (Extratos dos grandes
    // bancos BR sempre trazem a coluna Saldo; bancos sem saldo seriam caso futuro.)
    if (!amounts || amounts.length < 2) continue;

    // Penúltimo valor = lançamento; último = saldo corrente.
    const amountStr = amounts[amounts.length - 2]!.replace("−", "-");
    const rawCents = normalizeAmountCents(amountStr);
    if (rawCents === null || rawCents === 0) {
      orphanCount++;
      continue;
    }

    // Descrição = entre a data e o primeiro valor; remove Docto/CNPJ (dígitos longos no fim).
    const firstAmtIdx = rest.indexOf(amounts[0]!);
    let description = rest
      .slice(0, firstAmtIdx >= 0 ? firstAmtIdx : rest.length)
      .replace(/\s+\d{5,}\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!description) description = "Lançamento";

    entries.push({
      date,
      description,
      amountCents: Math.abs(rawCents),
      direction: normalizeDirection(null, rawCents),
    });
  }

  return { entries, orphanCount };
}

export async function parsePdfStatement(buffer: Buffer): Promise<ParseResult> {
  const text = await extractPdfText(buffer);
  const result = parseStatementText(text);
  logger.info(
    { entries: result.entries.length, orphanCount: result.orphanCount },
    "parsePdfStatement: extrato bancário parseado",
  );
  return result;
}
