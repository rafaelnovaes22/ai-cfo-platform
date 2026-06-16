import { z } from "zod";

const REFERENCE_MONTH = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado: YYYY-MM");

// Limites de entrada do ingest. Espelhados no frontend em app/src/lib/limits.ts.
// MAX_AMOUNT_REAIS precisa caber no Int4 do Postgres em cents (≤ R$21,4M) — ver
// MAX_AMOUNT_CENTS em normalize.ts.
export const MAX_CLIPBOARD_CHARS = 1_000_000; // ~50k linhas de extrato
export const MAX_MANUAL_ENTRIES = 200;
export const MAX_DESCRIPTION_CHARS = 200;
export const MAX_AMOUNT_REAIS = 20_000_000;

export const ClipboardBody = z.object({
  referenceMonth: REFERENCE_MONTH,
  text: z
    .string()
    .min(10)
    .max(MAX_CLIPBOARD_CHARS, `Texto excede o limite de ${MAX_CLIPBOARD_CHARS} caracteres`),
});

// Bounds rígidos: sem eles, o form aceitava amount "000…0"/1e308 (Infinity →
// overflow no Int4 do Postgres → 500) e date lixo (visto em prod 2026-06-11).
export const ManualEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  description: z.string().min(1).max(MAX_DESCRIPTION_CHARS),
  amount: z.union([
    z.number().finite().positive().max(MAX_AMOUNT_REAIS),
    // String é revalidada/limitada por normalizeAmountCents no parser.
    z.string().min(1).max(30),
  ]),
  direction: z.enum(["credit", "debit"]),
});

export const ManualBody = z.object({
  referenceMonth: REFERENCE_MONTH,
  entries: z.array(ManualEntrySchema).min(1).max(MAX_MANUAL_ENTRIES),
});

export const IngestResponse = z.object({
  analysisId: z.string(),
  referenceMonth: z.string(),
  entryCount: z.number(),
  orphanCount: z.number(),
  outcome: z.enum(["completed", "partial", "failed"]),
});
