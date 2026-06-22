import { z } from "zod";

export const GranularityEnum = z.enum(["daily", "weekly", "monthly", "quarterly"]);
export type GranularityEnum = z.infer<typeof GranularityEnum>;

export const CashflowQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate deve ser YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate deve ser YYYY-MM-DD"),
    granularity: GranularityEnum.default("monthly"),
    category: z.string().max(100).optional(),
    bankAccountId: z.string().uuid().optional(),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "startDate deve ser anterior ou igual a endDate",
  })
  .refine(
    (d) => {
      const ms =
        new Date(`${d.endDate}T00:00:00Z`).getTime() -
        new Date(`${d.startDate}T00:00:00Z`).getTime();
      return ms <= 60 * 31 * 24 * 60 * 60 * 1000;
    },
    { message: "Período máximo: 60 meses" }
  );
export type CashflowQuerySchema = z.infer<typeof CashflowQuerySchema>;

export const CashflowSummaryQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser YYYY-MM-DD")
    .optional(),
});
export type CashflowSummaryQuerySchema = z.infer<typeof CashflowSummaryQuerySchema>;

export const CashflowResponseSchema = z.object({
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    granularity: GranularityEnum,
  }),
  summary: z.object({
    openingBalanceCents: z.number().nullable(),
    closingBalanceCents: z.number().nullable(),
    totalCreditsCents: z.number(),
    totalDebitsCents: z.number(),
    creditCount: z.number(),
    debitCount: z.number(),
  }),
  chart: z.array(
    z.object({
      period: z.string(),
      creditsCents: z.number(),
      debitsCents: z.number(),
    })
  ),
  table: z.array(
    z.object({
      category: z.string(),
      parentCategory: z.string().nullable(),
      totalCents: z.number(),
      byPeriod: z.array(z.object({ period: z.string(), amountCents: z.number() })),
    })
  ),
  requestId: z.string(),
});
export type CashflowResponseSchema = z.infer<typeof CashflowResponseSchema>;

export const CashflowSummaryDaySchema = z.object({
  date: z.string(),
  balanceCents: z.number().nullable(),
  creditsCents: z.number(),
  debitsCents: z.number(),
  requestId: z.string(),
});
export type CashflowSummaryDaySchema = z.infer<typeof CashflowSummaryDaySchema>;
