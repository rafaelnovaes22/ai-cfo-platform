import { z } from "zod";
import { normalizeDate, normalizeAmountCents } from "@/ingest/normalize.js";
import type { ParseResult } from "@/ingest/types.js";

const ManualEntrySchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  direction: z.enum(["credit", "debit"]),
});

export function parseManual(entries: unknown[]): ParseResult {
  const result: ParseResult = { entries: [], orphanCount: 0 };

  for (const raw of entries) {
    const parsed = ManualEntrySchema.safeParse(raw);
    if (!parsed.success) { result.orphanCount++; continue; }

    const date = normalizeDate(parsed.data.date);
    const rawCents = normalizeAmountCents(parsed.data.amount);

    if (!date || rawCents === null) { result.orphanCount++; continue; }

    result.entries.push({
      date,
      description: parsed.data.description,
      amountCents: Math.abs(rawCents),
      direction: parsed.data.direction,
      // Direção escolhida pelo usuário no formulário — sempre confiável.
      directionSource: "explicit",
    });
  }

  return result;
}
