import { z } from "zod";

export const EvidenceSchema = z.object({
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
});
export type EvidenceSchema = z.infer<typeof EvidenceSchema>;

export const NarrativeCardSchema = z.object({
  id: z.string(),
  cardType: z.string(),
  title: z.string(),
  body: z.string(),
  evidence: z.array(EvidenceSchema),
  clientApproved: z.boolean().nullable(),
  clientComment: z.string().nullable(),
});
export type NarrativeCardSchema = z.infer<typeof NarrativeCardSchema>;

export const NarrativeFeedbackBody = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});
export type NarrativeFeedbackBody = z.infer<typeof NarrativeFeedbackBody>;

export const DreSnapshot = z.record(z.unknown());
export type DreSnapshot = z.infer<typeof DreSnapshot>;
