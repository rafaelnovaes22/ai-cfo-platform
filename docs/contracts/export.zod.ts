import { z } from "zod";

export const ReportType = z.enum(["monthly", "investors", "partners"]);
export type ReportType = z.infer<typeof ReportType>;

export const ExportParams = z.object({
  analysisId: z.string(),
  type: ReportType,
});
export type ExportParams = z.infer<typeof ExportParams>;
