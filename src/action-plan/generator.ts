import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { callLlm } from "@/llm/index.js";
import { buildActionPlanSystemPrompt, buildActionPlanUserPrompt } from "@/action-plan/prompts.js";
import { logger } from "@/observability/logger.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

const ActionSchema = z.object({
  horizon:     z.enum(["short", "medium", "long"]),
  title:       z.string(),
  description: z.string(),
  effortLevel: z.enum(["low", "medium", "high"]),
  riskLevel:   z.enum(["low", "medium", "high"]),
  impactCents: z.number().int().positive(),
  deadlineDays: z.number().int().positive().optional(),
  doneWhen:    z.string().optional(),
});

const PlanResponseSchema = z.object({
  actions: z.array(ActionSchema).min(5), // mínimo: 3 short + 1 medium + 1 long
});

function validateMinimums(actions: z.infer<typeof ActionSchema>[]): boolean {
  const byHorizon = (h: string) => actions.filter((a) => a.horizon === h).length;
  return byHorizon("short") >= 3 && byHorizon("medium") >= 1 && byHorizon("long") >= 1;
}

function calcImpactSummary(actions: z.infer<typeof ActionSchema>[]) {
  const sum = (h: string) =>
    actions.filter((a) => a.horizon === h).reduce((acc, a) => acc + a.impactCents, 0);
  return {
    shortImpact:  sum("short"),
    mediumImpact: sum("medium"),
    longImpact:   sum("long"),
    totalImpact:  actions.reduce((acc, a) => acc + a.impactCents, 0),
  };
}

export async function generateActionPlan(
  analysisId: string,
  tenantId: string,
  dre: DreLines,
): Promise<void> {
  const db = getPrisma();

  const [analysis, tenant, narrativeCards] = await Promise.all([
    db.monthlyAnalysis.findUniqueOrThrow({ where: { id: analysisId } }),
    db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    db.narrativeCard.findMany({ where: { analysisId }, orderBy: { createdAt: "asc" } }),
  ]);

  const config = (tenant.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;
  const toneOfVoice = config?.toneOfVoice ?? "formal";

  const systemPrompt = buildActionPlanSystemPrompt();
  const userPrompt = buildActionPlanUserPrompt({
    dre,
    referenceMonth: analysis.referenceMonth,
    segment: tenant.industrySegment,
    taxRegime: tenant.taxRegime,
    toneOfVoice,
    narrativeCards: narrativeCards.map((c) => ({
      type: c.cardType,
      title: c.title,
      body: c.body,
    })),
  });

  const llmResponse = await callLlm({
    task: "action-plan",
    systemPrompt,
    userPrompt,
    tenantId,
    jsonMode: true,
  });

  let parsed = PlanResponseSchema.parse(JSON.parse(llmResponse.content));

  // Retry único se mínimos não atendidos
  if (!validateMinimums(parsed.actions)) {
    logger.warn({ analysisId }, "Plano não atendeu mínimos — retry com instrução reforçada");

    const retryResponse = await callLlm({
      task: "action-plan",
      systemPrompt,
      userPrompt: userPrompt + "\n\nATENÇÃO: O plano DEVE ter no mínimo 3 ações 'short', 1 'medium' e 1 'long'.",
      tenantId,
      jsonMode: true,
    });
    parsed = PlanResponseSchema.parse(JSON.parse(retryResponse.content));
  }

  const impact = calcImpactSummary(parsed.actions);

  await db.$transaction(async (tx) => {
    await tx.actionPlanItem.deleteMany({ where: { analysisId } });

    await tx.actionPlanItem.createMany({
      data: parsed.actions.map((a) => ({
        analysisId,
        horizon:     a.horizon,
        title:       a.title,
        description: a.description,
        effortLevel: a.effortLevel,
        riskLevel:   a.riskLevel,
        impactCents: a.impactCents,
        deadlineDays: a.deadlineDays ?? null,
        doneWhen:    a.doneWhen ?? null,
      })),
    });

    // Determina status final conforme o modo da assinatura (C4)
    const isAutonomous = analysis.mode === "autonomous";
    await tx.monthlyAnalysis.update({
      where: { id: analysisId },
      data: {
        actionPlanJson: { ...impact, actions: parsed.actions },
        costCents:      (analysis.costCents ?? 0) + llmResponse.costCents,
        status:         isAutonomous ? "delivered" : "ready",
        deliveredAt:    isAutonomous ? new Date() : null,
      },
    });
  });

  logger.info(
    {
      analysisId,
      actionCount: parsed.actions.length,
      totalImpactCents: impact.totalImpact,
      costCents: llmResponse.costCents,
      mode: analysis.mode,
    },
    "Plano de ação gerado",
  );
}
