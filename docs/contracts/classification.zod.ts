import { z } from "zod";

export const CorrectBody = z.object({
  category: z.string().min(1),
  source: z.enum(["operator", "client", "needs_review"]).default("client"),
});
export type CorrectBody = z.infer<typeof CorrectBody>;

export const ReviewEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amountCents: z.number(),
  direction: z.string(),
  predictedCategory: z.string().nullable(),
  confirmedCategory: z.string().nullable(),
  classificationConfidence: z.number().nullable(),
  correctionSource: z.string().nullable(),
});
export type ReviewEntrySchema = z.infer<typeof ReviewEntrySchema>;

export const ClassificationReviewResponse = z.object({
  data: z.array(ReviewEntrySchema),
  meta: z.object({
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.number(),
    requestId: z.string(),
  }),
});
export type ClassificationReviewResponse = z.infer<typeof ClassificationReviewResponse>;

export const ClassificationCorrectResponse = z.object({
  id: z.string(),
  confirmedCategory: z.string(),
  direction: z.enum(["credit", "debit"]),
});
export type ClassificationCorrectResponse = z.infer<typeof ClassificationCorrectResponse>;
