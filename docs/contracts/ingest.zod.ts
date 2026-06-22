import { z } from "zod";

const REFERENCE_MONTH = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado: YYYY-MM");

export const MAX_CLIPBOARD_CHARS = 1_000_000;
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
export type ClipboardBody = z.infer<typeof ClipboardBody>;

export const ManualEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  description: z.string().min(1).max(MAX_DESCRIPTION_CHARS),
  amount: z.union([
    z.number().finite().positive().max(MAX_AMOUNT_REAIS),
    z.string().min(1).max(30),
  ]),
  direction: z.enum(["credit", "debit"]),
});
export type ManualEntrySchema = z.infer<typeof ManualEntrySchema>;

export const ManualBody = z.object({
  referenceMonth: REFERENCE_MONTH,
  entries: z.array(ManualEntrySchema).min(1).max(MAX_MANUAL_ENTRIES),
});
export type ManualBody = z.infer<typeof ManualBody>;

export const IngestResponse = z.object({
  analysisId: z.string(),
  referenceMonth: z.string(),
  entryCount: z.number(),
  orphanCount: z.number(),
  outcome: z.enum(["completed", "partial", "failed"]),
});
export type IngestResponse = z.infer<typeof IngestResponse>;
