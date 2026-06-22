import { z } from "zod";

export const ActionItemSchema = z.object({
  id: z.string(),
  horizon: z.enum(["short", "medium", "long"]),
  title: z.string(),
  description: z.string(),
  effortLevel: z.enum(["low", "medium", "high"]),
  riskLevel: z.enum(["low", "medium", "high"]),
  impactCents: z.number(),
  deadlineDays: z.number().nullable(),
  doneWhen: z.string().nullable(),
  clientApproved: z.boolean().nullable(),
  clientComment: z.string().nullable(),
  status: z.string(),
  statusReason: z.string().nullable(),
  lastStatusUpdatedAt: z.string().datetime().nullable(),
});
export type ActionItemSchema = z.infer<typeof ActionItemSchema>;

export const ActionPlanResponse = z.object({
  analysisStatus: z.string(),
  items: z.array(ActionItemSchema),
  summary: z.object({
    shortImpact: z.number(),
    mediumImpact: z.number(),
    longImpact: z.number(),
    totalImpact: z.number(),
  }),
});
export type ActionPlanResponse = z.infer<typeof ActionPlanResponse>;

export const ActionPlanFeedbackBody = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});
export type ActionPlanFeedbackBody = z.infer<typeof ActionPlanFeedbackBody>;

export const ActionStatusBody = z.object({
  status: z.enum(["pending", "in_progress", "blocked", "done", "abandoned"]),
  reason: z.string().max(500).optional(),
});
export type ActionStatusBody = z.infer<typeof ActionStatusBody>;

export const ApproveAnalysisResponse = z.object({
  status: z.string(),
  approvedAt: z.string(),
});
export type ApproveAnalysisResponse = z.infer<typeof ApproveAnalysisResponse>;
