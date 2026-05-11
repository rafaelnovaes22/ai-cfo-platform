import { z } from "zod";

const REFERENCE_MONTH = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado: YYYY-MM");

export const ClipboardBody = z.object({
  referenceMonth: REFERENCE_MONTH,
  text: z.string().min(10),
});

export const ManualBody = z.object({
  referenceMonth: REFERENCE_MONTH,
  entries: z.array(
    z.object({
      date: z.string(),
      description: z.string().min(1),
      amount: z.union([z.number(), z.string()]),
      direction: z.enum(["credit", "debit"]),
    }),
  ).min(1),
});

export const IngestResponse = z.object({
  analysisId: z.string(),
  referenceMonth: z.string(),
  entryCount: z.number(),
  orphanCount: z.number(),
  outcome: z.enum(["completed", "partial", "failed"]),
});
