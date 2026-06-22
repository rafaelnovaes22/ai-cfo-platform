import { z } from "zod";

export const DreSnapshotSchema = z.object({
  receitaBruta: z.number(),
  lucroLiquido: z.number(),
  margemLiquida: z.number(),
  ebitda: z.number(),
  margemEbitda: z.number(),
});
export type DreSnapshotSchema = z.infer<typeof DreSnapshotSchema>;

export const TrendPointSchema = z.object({
  referenceMonth: z.string(),
  receitaLiquida: z.number(),
  lucroLiquido: z.number(),
  ebitda: z.number(),
  margemBruta: z.number(),
  margemOperacional: z.number(),
  margemLiquida: z.number(),
});
export type TrendPointSchema = z.infer<typeof TrendPointSchema>;

export const AnomalyTimelinePointSchema = z.object({
  referenceMonth: z.string(),
  total: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
  codes: z.array(z.string()),
});
export type AnomalyTimelinePointSchema = z.infer<typeof AnomalyTimelinePointSchema>;

export const AnalysisSummarySchema = z.object({
  id: z.string(),
  referenceMonth: z.string(),
  status: z.string(),
  mode: z.string(),
  deliveredAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  costCents: z.number().nullable(),
  totalImpactCents: z.number().nullable(),
});
export type AnalysisSummarySchema = z.infer<typeof AnalysisSummarySchema>;

export const HubResponse = z.object({
  subscription: z.object({
    plan: z.string(),
    mode: z.string(),
    status: z.string(),
  }),
  latestAnalysis: z
    .object({
      id: z.string(),
      referenceMonth: z.string(),
      status: z.string(),
      mode: z.string(),
      deliveredAt: z.string().nullable(),
      approvedAt: z.string().nullable(),
      dre: DreSnapshotSchema.nullable(),
      cards: z.object({
        critical_gap: z.number(),
        attention: z.number(),
        healthy: z.number(),
      }),
      actionPlan: z
        .object({
          total: z.number(),
          shortImpactCents: z.number(),
          mediumImpactCents: z.number(),
          longImpactCents: z.number(),
          totalImpactCents: z.number(),
        })
        .nullable(),
    })
    .nullable(),
});
export type HubResponse = z.infer<typeof HubResponse>;

export const TrendResponse = z.object({
  trend: z.array(TrendPointSchema),
});
export type TrendResponse = z.infer<typeof TrendResponse>;

export const AnomalyTimelineResponse = z.object({
  timeline: z.array(AnomalyTimelinePointSchema),
});
export type AnomalyTimelineResponse = z.infer<typeof AnomalyTimelineResponse>;

export const AnalysesResponse = z.object({
  analyses: z.array(AnalysisSummarySchema),
});
export type AnalysesResponse = z.infer<typeof AnalysesResponse>;

export const AnalysisStatusResponse = z.object({
  id: z.string(),
  referenceMonth: z.string(),
  status: z.string(),
  mode: z.string(),
  hasActionPlan: z.boolean(),
  actionItemCount: z.number(),
  generatedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
});
export type AnalysisStatusResponse = z.infer<typeof AnalysisStatusResponse>;

export const RetryAnalysisResponse = z.object({
  id: z.string(),
  status: z.string(),
});
export type RetryAnalysisResponse = z.infer<typeof RetryAnalysisResponse>;
