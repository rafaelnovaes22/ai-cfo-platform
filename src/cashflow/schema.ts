import { z } from "zod";

export const GranularityEnum = z.enum(["daily", "weekly", "monthly", "quarterly"]);

export const CashflowQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate deve ser YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate deve ser YYYY-MM-DD"),
  granularity: GranularityEnum.default("monthly"),
  category: z.string().max(100).optional(),
  bankAccountId: z.string().uuid().optional(),
}).refine(
  (d) => d.startDate <= d.endDate,
  { message: "startDate deve ser anterior ou igual a endDate" }
).refine(
  // Teto de 60 meses: sem ele, um range 1900→2100 vira full scan no Postgres.
  (d) => {
    const ms = new Date(`${d.endDate}T00:00:00Z`).getTime() - new Date(`${d.startDate}T00:00:00Z`).getTime();
    return ms <= 60 * 31 * 24 * 60 * 60 * 1000;
  },
  { message: "Período máximo: 60 meses" }
);

export const CashflowSummaryQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser YYYY-MM-DD")
    .optional(),
});

const ChartEntrySchema = z.object({
  period: z.string(),
  creditsCents: z.number(),
  debitsCents: z.number(),
});

const TableRowSchema = z.object({
  category: z.string(),
  parentCategory: z.string().nullable(),
  totalCents: z.number(),
  byPeriod: z.array(z.object({ period: z.string(), amountCents: z.number() })),
});

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
  chart: z.array(ChartEntrySchema),
  table: z.array(TableRowSchema),
  requestId: z.string(),
});

export const CashflowSummaryDaySchema = z.object({
  date: z.string(),
  balanceCents: z.number().nullable(),
  creditsCents: z.number(),
  debitsCents: z.number(),
  requestId: z.string(),
});
